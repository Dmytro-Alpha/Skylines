# -*- coding: utf-8 -*-

import os
import datetime
from lxml import etree
from skylines import files

def import_datetime_attribute(node, name):
    if node is None or not name in node.attrib:
        return None
    try:
        return datetime.datetime.strptime(node.attrib[name], '%Y-%m-%dT%H:%M:%SZ')
    except ValueError:
        return None

def find_contest(root, name):
    for contest in root.findall('contest'):
        if contest.attrib['name'] == name:
            return contest
    return None

def find_trace(contest, name):
    for contest in contest.findall('trace'):
        if contest.attrib['name'] == name:
            return contest
    return None

def analyse_flight(flight):
    path = files.filename_to_path(flight.filename)
    f = os.popen('/opt/skylines/bin/AnalyseFlight "' + path + '"')
    doc = etree.parse(f)
    f.close()
    root = doc.getroot()

    times = root.find('times')
    flight.takeoff_time = import_datetime_attribute(times, "takeoff")
    flight.landing_time = import_datetime_attribute(times, "landing")

    contest = find_contest(root, 'olc_plus')
    if contest is not None:
        trace = find_trace(contest, 'classic')
        if trace is not None:
            flight.olc_classic_distance = int(float(trace.attrib['distance']))
        else:
            flight.olc_classic_distance = None

        trace = find_trace(contest, 'triangle')
        if trace is not None:
            flight.olc_triangle_distance = int(float(trace.attrib['distance']))
        else:
            flight.olc_triangle_distance = None

        trace = find_trace(contest, 'plus')
        if trace is not None:
            flight.olc_plus_score = int(float(trace.attrib['score']))
        else:
            flight.olc_plus_score = None

def flight_path(flight):
    path = files.filename_to_path(flight.filename)
    f = os.popen('/opt/skylines/bin/FlightPath "' + path + '"')

    path = []
    for line in f:
        line = line.split()
        path.append((float(line[2]), float(line[1])))
    return path
