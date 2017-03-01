

/**
 * Array of flight objects. (see addFlight method)
 */
var flights = slFlightCollection();
var contests = slContestCollection();

var map;
var baro;
var fix_table;
var map_icon_handler;
var play_button;

/*
 * Global time, can be:
 * null -> no time is set, don't show barogram crosshair/plane position
 * -1 -> always show the latest time/fix for each flight
 * >= 0 -> show the associated time in the barogram and on the map
 */
var default_time = null;
var global_time = default_time;


/**
 * List of colors for flight path display
 */
var colors = ['#004bbd', '#bf0099', '#cf7c00', '#ff0000', '#00c994', '#ffff00'];


/**
 * Style function
 * @param {ol.feature} feature - Feature to style
 * @return {Array} style
 */
function style_function(feature) {
  if (!$.inArray('type', feature.getKeys()))
    return null;

  var color = '#004bbd'; // default color
  if ($.inArray('color', feature.getKeys()))
    color = feature.get('color');

  var z_index = 1000; // default z-index
  var line_dash = undefined; // default line style

  switch (feature.get('type')) {
    case 'flight':
      z_index = 1000;
      break;

    case 'contest':
      z_index = 999;
      line_dash = [5];
      break;
  }

  return [new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: color,
      width: 2,
      lineDash: line_dash
    }),
    zIndex: z_index
  })];
}


/**
 * Initialize the map and add airspace and flight path layers.
 */
function initFlightLayer() {
  var flight_path_layer = new ol.layer.Image({
    source: new ol.source.ImageVector({
      source: flights.getSource(),
      style: style_function
    }),
    name: 'Flight',
    z_index: 50
  });

  map.addLayer(flight_path_layer);

  var flight_contest_layer = new ol.layer.Vector({
    source: contests.getSource(),
    style: style_function,
    name: 'Contest',
    z_index: 49
  });

  map.addLayer(flight_contest_layer);
  map.on('moveend', function(e) {
    if (updateBaroScale())
      baro.draw();
  });

  map_icon_handler.setMode(true);

  play_button = new PlayButton();
  map.addControl(play_button);

  setupEvents();
}

function initFixTable() {
  fix_table = slFixTable($('#fix-data'));
  $(fix_table).on('selection_changed', function(e) {
    updateBaroData();
    baro.draw();
  });
  $(fix_table).on('remove_flight', function(e, sfid) {
    // never remove the first flight...
    if (flights.at(0).getID() == sfid) return;
    flights.remove(sfid);
  });
}

function updateBaroScale() {
  var extent = map.getView().calculateExtent(map.getSize());
  var interval = flights.getMinMaxTimeInExtent(extent);

  var redraw = false;

  if (interval.max == -Infinity) {
    baro.clearTimeInterval();
    redraw = true;
  } else {
    redraw = baro.setTimeInterval(interval.min, interval.max);
  }

  return redraw;
}


/**
 * Add a flight to the map and barogram.
 *
 * @param {Object} data The data received from the JSON request.
 */
function addFlight(data) {
  flight = slFlight(data.sfid, data.points,
                    data.barogram_t, data.barogram_h,
                    data.enl,
                    data.elevations_t, data.elevations_h, data.additional);

  flight.setColor(data.additional.color ||
                  colors[flights.length() % colors.length]);

  if (data.contests) {
    var _contestsLength = data.contests.length;
    for (var i = 0; i < _contestsLength; ++i)
      contests.add(slContest(data.contests[i], flight.getID()));
  }

  flights.add(flight);
}


/**
 * @param {string} url URL to fetch.
 * @param {boolean} async do asynchronous request (defaults true)
 */
function addFlightFromJSON(url, async) {
  $.ajax(url, {
    async: (typeof async === undefined) || async === true,
    success: function(data) {
      if (flights.has(data.sfid))
        return;

      addFlight(data);
      map.render();
    }
  });
}


function setupEvents() {
  $(flights).on('preremove', function(e, flight) {
    // Hide plane to remove any additional related objects from the map
    map_icon_handler.hidePlane(flight);
  });

  $(flights).on('removed', function(e, sfid) {
    $('#wingman-table').find('*[data-sfid=' + sfid + ']')
        .find('.color-stripe').css('background-color', '');

    fix_table.removeRow(sfid);
    updateBaroData();
    updateBaroScale();
    baro.draw();
  });

  $(flights).on('add', function(e, flight) {
    // Add flight as a row to the fix data table
    fix_table.addRow(flight.getID(), flight.getColor(),
                     flight.getCompetitionID());

    updateBaroData();
    updateBaroScale();
    baro.draw();

    $('#wingman-table').find('*[data-sfid=' + flight.getID() + ']')
        .find('.color-stripe').css('background-color', flight.getColor());

    // Set fix data table into "selectable" mode if
    // more than one flight is loaded
    if (flights.length() > 1)
      fix_table.setSelectable(true);

    setTime(global_time);
  });

  $(play_button).on('play', function(e) {
    // if there are no flights, then there is nothing to animate
    if (flights.length == 0)
      return false;

    // if no time is set
    if (global_time == null || global_time == -1) {
      // find the first timestamp of all flights
      var start_time = Number.MAX_VALUE;
      flights.each(function(flight) {
        if (flight.getStartTime() < start_time)
          start_time = flight.getStartTime();
      });

      // start the animation at the beginning
      setTime(start_time);
    }

    // disable mouse hovering
    map_icon_handler.setMode(false);
    baro.setHoverMode(false);

    return true;
  });

  $(play_button).on('stop', function(e) {
    // reenable mouse hovering
    map_icon_handler.setMode(true);
    baro.setHoverMode(true);
  });

  $(play_button).on('tick', function(e) {
    // increase time
    var time = global_time + 1;

    // find the last timestamp of all flights
    var stop_time = Number.MIN_VALUE;
    flights.each(function(flight) {
      if (flight.getEndTime() > stop_time)
        stop_time = flight.getEndTime();
    });

    // check if we are at the end of the animation
    if (time > stop_time) {
      stop();
      return false;
    }

    // set the time for the new animation frame
    setTime(time);

    return true;
  });
}


function initBaro(element) {
  baro = slBarogram(element);

  var mouse_container_running = false;
  $(baro).on('barohover', function(event, time) {
    if (mouse_container_running)
      return;

    mouse_container_running = true;

    setTimeout(function() {
      mouse_container_running = false;
    }, 25);

    setTime(time);
  }).on('baroclick', function(event, time) {
    setTime(time);
  }).on('mouseout', function(event) {
    setTime(default_time);
  });

  baro.setHoverMode(true);
}

function updateBaroData() {
  var _contests = [], elevations = [];

  var active = [], passive = [], enls = [];
  flights.each(function(flight) {
    var data = {
      data: flight.getFlotHeight(),
      color: flight.getColor()
    };

    var enl_data = {
      data: flight.getFlotENL(),
      color: flight.getColor()
    };

    if (fix_table.getSelection() &&
        flight.getID() != fix_table.getSelection()) {
      passive.push(data);
    } else {
      active.push(data);
      enls.push(enl_data);
    }

    // Save contests of highlighted flight for later
    if (fix_table.getSelection() &&
        flight.getID() == fix_table.getSelection()) {
      _contests = contests.all(flight.getID());
      elevations = flight.getFlotElev();
    }

    // Save contests of only flight for later if applicable
    if (flights.length() == 1) {
      _contests = contests.all(flight.getID());
      elevations = flight.getFlotElev();
    }
  });

  baro.setActiveTraces(active);
  baro.setPassiveTraces(passive);
  baro.setENLData(enls);
  baro.setContests(_contests);
  baro.setElevations(elevations);
}

function setTime(time) {
  global_time = time;

  // if the mouse is not hovering over the barogram or any trail on the map
  if (!time) {
    // remove crosshair from barogram
    baro.clearTime();

    // remove plane icons from map
    map_icon_handler.hideAllPlanes();

    // remove data from fix-data table
    fix_table.clearAllFixes();

  } else {
    // update barogram crosshair
    baro.setTime(time);

    flights.each(function(flight) {
      // calculate fix data
      var fix_data = flight.getFixData(time);
      if (!fix_data) {
        // update map
        map_icon_handler.hidePlane(flight);

        // update fix-data table
        fix_table.clearFix(flight.getID());
      } else {
        // update map
        map_icon_handler.showPlane(flight, fix_data);

        // update fix-data table
        fix_table.updateFix(flight.getID(), fix_data);
      }
    });
  }

  map.render();
  fix_table.render();
}
