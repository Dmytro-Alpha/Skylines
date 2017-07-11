import Ember from 'ember';

import safeComputed from '../utils/safe-computed';
import { addAltitudeUnit } from '../utils/units';

export default Ember.Component.extend(Ember.Evented, {
  fixCalc: Ember.inject.service(),
  flightPhase: Ember.inject.service(),

  height: 133,

  flot: null,
  time: Ember.computed.alias('fixCalc.time'),
  selection: null,
  flights: Ember.computed.readOnly('fixCalc.flights'),

  activeFlights: Ember.computed('flights.[]', 'selection', function() {
    let { flights, selection } = this.getProperties('flights', 'selection');
    return flights.filter(flight => (!selection || flight.get('id') === selection));
  }),

  passiveFlights: Ember.computed('flights.[]', 'selection', function() {
    let { flights, selection } = this.getProperties('flights', 'selection');
    return flights.filter(flight => (selection && flight.get('id') !== selection));
  }),

  active: Ember.computed('activeFlights.@each.{flot_h,color}', function() {
    return this.get('activeFlights').map(flight => ({
      data: flight.get('flot_h'),
      color: flight.get('color'),
    }));
  }),

  passive: Ember.computed('passiveFlights.@each.{flot_h,color}', function() {
    return this.get('passiveFlights').map(flight => ({
      data: flight.get('flot_h'),
      color: flight.get('color'),
    }));
  }),

  enls: Ember.computed('activeFlights.@each.{flot_enl,color}', function() {
    return this.get('activeFlights').map(flight => ({
      data: flight.get('flot_enl'),
      color: flight.get('color'),
    }));
  }),

  selectedFlight: Ember.computed('flights.[]', 'selection', function() {
    let { flights, selection } = this.getProperties('flights', 'selection');
    if (flights.get('length') === 1) {
      return flights.get('firstObject');
    } else if (selection) {
      return flights.findBy('id', selection);
    }
  }),

  contests: safeComputed('selectedFlight', flight => flight.get('contests')),
  elevations: safeComputed('selectedFlight', flight => flight.get('flot_elev')),

  timeHighlight: Ember.computed.readOnly('flightPhase.selection'),
  hoverMode: Ember.computed.not('fixCalc.isRunning'),

  flotStyle: Ember.computed('height', function() {
    return Ember.String.htmlSafe(`width: 100%; height: ${this.get('height')}px;`);
  }),

  init() {
    this._super(...arguments);

    let global = 'barogram';
    if (this.get('prefix')) {
      global += `-${this.get('prefix')}`;
    }

    window[global] = this;
  },

  draw() {
    this.update();
    this.updateCrosshair();

    let flot = this.get('flot');
    flot.setupGrid();
    flot.draw();
  },

  timeObserver: Ember.observer('time', function() {
    Ember.run.once(this, 'updateCrosshair');
  }),

  updateCrosshair() {
    let { flot, time } = this.getProperties('flot', 'time');

    if (time === null) {
      flot.clearCrosshair();
    } else if (time == -1) {
      flot.lockCrosshair({x: 999999999});
    } else {
      flot.lockCrosshair({x: time * 1000});
    }
  },

  timeIntervalObserver: Ember.observer('timeInterval', function() {
    this.updateInterval();
  }),

  updateInterval() {
    let { flot, timeInterval: interval } = this.getProperties('flot', 'timeInterval');
    let opt = flot.getOptions();

    if (!interval) {
      opt.xaxes[0].min = opt.xaxes[0].max = null;
    } else {
      let [start, end] = interval;
      opt.xaxes[0].min = start * 1000;
      opt.xaxes[0].max = end * 1000;
    }
  },

  enableFlightSelection() {
    var opt = this.get('flot').getOptions();
    opt.selection.mode = 'x';
  },

  setFlightTimes(takeoff, scoring_start, scoring_end, landing) {
    this.get('flot').setSelection({
      takeoff: takeoff * 1000,
      scoring_start: scoring_start * 1000,
      scoring_end: scoring_end * 1000,
      landing: landing * 1000,
    });
  },

  updateFlightTime(time, field) {
    this.get('flot').updateSelection(time * 1000, field);
  },

  getFlightTime() {
    return this.get('flot').getSelection();
  },

  hoverModeObserver: Ember.observer('hoverMode', function() {
    Ember.run.once(this, 'onHoverModeUpdate');
  }),

  didInsertElement() {
    var opts = {
      grid: {
        borderWidth: 0,
        hoverable: true,
        clickable: true,
        autoHighlight: false,
        margin: 5,
      },
      xaxis: {
        mode: 'time',
        timeformat: '%H:%M',
      },
      yaxes: [
        {
          min: 0,
          tickFormatter: addAltitudeUnit,
        },
        {
          show: false,
          min: 0,
          max: 1000,
        },
      ],
      crosshair: {
        mode: 'x',
      },
    };

    if (this.get('uploadMode')) {
      opts.selection = {
        mode: 'x',
      };

      opts.crosshair = {
        mode: null,
      };
    }

    var placeholder = this.$('div');

    this.set('placeholder', placeholder);
    this.set('flot', Ember.$.plot(placeholder, [], opts));

    placeholder.on('plotclick', (event, pos) => {
      this.trigger('baroclick', pos.x / 1000);
    });

    placeholder.on('plotselecting', (event, range, marker) => {
      this.trigger('baroselecting', range, marker);
    });

    this.onHoverModeUpdate();
  },

  onHoverModeUpdate() {
    let placeholder = this.get('placeholder');

    if (this.get('hoverMode')) {
      placeholder.on('plothover', (event, pos) => {
        this.trigger('barohover', pos.x / 1000);
      });

      placeholder.on('mouseout', () => {
        this.trigger('mouseout');
      });
    } else {
      placeholder.off('plothover');
      placeholder.off('mouseout');
    }
  },

  update() {
    var data = [];
    this.addElevations(data);
    this.addActiveTraces(data);
    this.addPassiveTraces(data);
    this.addENLData(data);
    this.addContests(data);
    this.updateTimeHighlight();

    this.get('flot').setData(data);
  },

  addActiveTraces(data) {
    this.get('active').forEach(trace => {
      data.push({
        data: trace.data,
        color: trace.color,
      });
    });
  },

  addPassiveTraces(data) {
    this.get('passive').forEach(trace => {
      let color = Ember.$.color.parse(trace.color).add('a', -0.6).toString();

      data.push({
        data: trace.data,
        color: color,
        shadowSize: 0,
        lines: {
          lineWidth: 1,
        },
      });
    });
  },

  addENLData(data) {
    this.get('enls').forEach(enl => {
      data.push({
        data: enl.data,
        color: enl.color,
        lines: {
          lineWidth: 0,
          fill: 0.2,
        },
        yaxis: 2,
      });
    });
  },

  addContests(data) {
    // Skip the function if there are no contest markers
    let contests = this.get('contests');
    if (!contests) {
      return;
    }

    // Iterate through the contests
    contests.forEach(contest => {
      let times = contest.get('times');
      if (times.length < 1) {
        return;
      }

      let color = contest.get('color');

      // Add the turnpoint markers to the markings array
      let markings = times.map(time => {
        return {
          position: time * 1000,
        };
      });

      // Add the chart series for this contest to the data array
      data.push({
        marks: {
          show: true,
          lineWidth: 1,
          toothSize: 6,
          color: color,
          fillColor: color,
        },
        data: [],
        markdata: markings,
      });
    });
  },

  addElevations(data) {
    data.push({
      data: this.get('elevations'),
      color: 'rgb(235, 155, 98)',
      lines: {
        lineWidth: 0,
        fill: 0.8,
      },
    });
  },

  updateTimeHighlight() {
    // There is no flot.setOptions(), so we modify them in-place.
    var options = this.get('flot').getOptions();

    // Clear the markings if there is no time highlight
    let time_highlight = this.get('timeHighlight');
    if (!time_highlight) {
      options.grid.markings = [];
      return;
    }

    // Add time highlight as flot markings
    options.grid.markings = [{
      color: '#fff083',
      xaxis: {
        from: time_highlight.start * 1000,
        to: time_highlight.end * 1000,
      },
    }];
  },

  flightPhaseObserver: Ember.observer('timeHighlight', function() {
    Ember.run.once(this, 'draw');
  }),
});
