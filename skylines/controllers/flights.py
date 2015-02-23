# -*- coding: utf-8 -*-

from tg import expose, require, request, redirect, config
from tg.i18n import ugettext as _, lazy_ugettext as l_
from repoze.what.predicates import has_permission
from webob.exc import HTTPNotFound
from sqlalchemy.sql.expression import desc
from skylines.lib.base import BaseController
from skylines import files
from skylines.model import DBSession, Flight

class FlightController(BaseController):
    def __init__(self, flight):
        self.flight = flight

    @expose('skylines.templates.flights.view')
    def index(self):
        from skylines.lib.analysis import flight_path
        fixes = flight_path(self.flight)

        import cgpolyencode
        encoder = cgpolyencode.GPolyEncoder(num_levels=4)
        fixes = encoder.encode(fixes)

        return dict(page='flights', flight=self.flight, fixes=fixes)

    @expose('skylines.templates.flights.map')
    def map(self):
        from skylines.lib.analysis import flight_path
        fixes = flight_path(self.flight)

        import cgpolyencode
        encoder = cgpolyencode.GPolyEncoder(num_levels=4)
        fixes = encoder.encode(fixes)

        return dict(page='flights', fixes=fixes)

    @expose()
    @require(has_permission('upload'))
    def analysis(self):
        """Hidden method that restarts flight analysis."""

        from skylines.lib.analysis import analyse_flight
        analyse_flight(self.flight)
        DBSession.flush()

        return redirect('/flights/id/' + str(self.flight.id))

class FlightIdController(BaseController):
    @expose()
    def lookup(self, id, *remainder):
        flight = DBSession.query(Flight).get(int(id))
        if flight is None:
            raise HTTPNotFound

        controller = FlightController(flight)
        return controller, remainder

class FlightsController(BaseController):
    @expose('skylines.templates.flights.list')
    def index(self):
        flights = DBSession.query(Flight).order_by(desc(Flight.takeoff_time))
        return dict(page='flights', flights=flights)

    @expose('skylines.templates.flights.list')
    def my(self):
        flights = DBSession.query(Flight).order_by(desc(Flight.takeoff_time))
        if request.identity is not None:
            flights = flights.filter(Flight.owner == request.identity['user'])
        return dict(page='flights', flights=flights)

    @expose()
    @require(has_permission('manage'))
    def analysis(self):
        """Hidden method that restarts flight analysis."""

        from skylines.lib.analysis import analyse_flight
        for flight in DBSession.query(Flight):
            analyse_flight(flight)
            DBSession.flush()

        return redirect('/flights/')

    id = FlightIdController()
