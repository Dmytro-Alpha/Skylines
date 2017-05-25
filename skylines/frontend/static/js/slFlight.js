/**
 * A SkyLines flight.
 * @constructor
 * @param {Number} _sfid SkyLines flight ID.
 * @param {String} _lonlat Google polyencoded string of geolocations
 *   (lon + lat, WSG 84).
 * @param {String} _time Google polyencoded string of time values.
 * @param {String} _height Google polyencoded string of height values.
 * @param {String} _enl Google polyencoded string of engine noise levels.
 * @param {String} _elev_t Google polyencoded string of elevation
 *   time values.
 * @param {String} _elev_h Google polyencoded string of elevations.
 * @param {Number} _geoid Approximate geoid height at the takeoff location
 * @param {Object=} opt_additional May contain additional information about
 *   the flight, e.g. registration number, callsign, ...
 */
slFlight = Ember.Object.extend({
  fixes: [],
  elevations: [],

  time: Ember.computed.mapBy('fixes', 'time'),

  coordinates: Ember.computed.map('fixes', function(fix) {
    var coordinate = [fix.latitude, fix.longitude, fix.altitude, fix.time];
    return ol.proj.transform(coordinate, 'EPSG:4326', 'EPSG:3857');
  }),

  flot_h: Ember.computed.map('fixes', function(fix) {
    return [fix.time * 1000, slUnits.convertAltitude(fix.altitude)];
  }),

  flot_enl: Ember.computed.map('fixes', function(fix) {
    return [fix.time * 1000, fix.enl];
  }),

  elev_t: Ember.computed.mapBy('elevations', 'time'),
  elev_h: Ember.computed.mapBy('elevations', 'elevation'),

  flot_elev: Ember.computed.map('elevations', function(it) {
    return [it.time * 1000, it.elevation ? slUnits.convertAltitude(it.elevation) : null];
  }),

  color: null,
  last_update: Ember.computed.readOnly('time.lastObject'),

  startTime: Ember.computed.readOnly('time.firstObject'),
  endTime: Ember.computed.readOnly('time.lastObject'),

  coordinatesObserver: Ember.observer('coordinates', function() {
    var coordinates = this.get('coordinates');
    this.get('geometry').setCoordinates(coordinates, 'XYZM')
  }),

  init: function() {
    this.set('geometry', new ol.geom.LineString(this.get('coordinates'), 'XYZM'));
    this.set('plane', { point: null, marker: null });
  },

  getID: function() {
    return this.get('id');
  }
});

slFlight.fromData = function(data) {
  var _time = ol.format.Polyline.decodeDeltas(data.barogram_t, 1, 1);
  var _lonlat = ol.format.Polyline.decodeDeltas(data.points, 2);
  var _height = ol.format.Polyline.decodeDeltas(data.barogram_h, 1, 1);
  var _enl = ol.format.Polyline.decodeDeltas(data.enl, 1, 1);

  var fixes = _time.map(function(timestamp, i) {
    return {
      time: timestamp,
      longitude: _lonlat[i * 2],
      latitude: _lonlat[i * 2 + 1],
      altitude: _height[i] + data.geoid,
      enl: _enl[i]
    };
  });

  var _elev_t = ol.format.Polyline.decodeDeltas(data.elevations_t, 1, 1);
  var _elev_h = ol.format.Polyline.decodeDeltas(data.elevations_h, 1, 1);

  var elevations = _elev_t.map(function(timestamp, i) {
    var elevation = _elev_h[i];

    return {
      time: timestamp,
      elevation: (elevation > -500) ? elevation : null
    }
  });

  var additional = data.additional || {};

  return slFlight.create({
    id: data.sfid,
    fixes: fixes,
    elevations: elevations,
    geoid: data.geoid,
    competition_id: additional.competition_id,
    registration: additional.registration
  });
};
