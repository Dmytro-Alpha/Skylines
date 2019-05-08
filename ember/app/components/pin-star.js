import Component from '@ember/component';
import { action, computed } from '@ember/object';
import { inject as service } from '@ember/service';

export default class PinStar extends Component {
  @service pinnedFlights;

  tagName = '';

  @computed('pinnedFlights.pinned.[]', 'flightId')
  get pinned() {
    return this.pinnedFlights.pinned.includes(this.flightId);
  }

  @action handleClick() {
    this.pinnedFlights.toggle(this.flightId);
  }
}
