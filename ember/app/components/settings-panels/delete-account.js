import Component from '@ember/component';
import { inject as service } from '@ember/service';

import { validator, buildValidations } from 'ember-cp-validations';
import { task } from 'ember-concurrency';

const Validations = buildValidations({
  password: {
    descriptionKey: 'password',
    validators: [
      validator('presence', true),
      validator('current-password', {
        messageKey: 'wrong-current-password',
      }),
    ],
    debounce: 500,
  },
});

export default Component.extend(Validations, {
  ajax: service(),
  session: service(),

  classNames: ['panel', 'panel-default'],

  password: null,

  messageKey: null,
  error: null,

  actions: {
    async submit() {
      let { validations } = await this.validate();
      if (validations.get('isValid')) {
        this.deleteTask.perform();
      }
    },
  },

  deleteTask: task(function*() {
    let json = this.getProperties('password');

    try {
      yield this.ajax.request('/api/account', { method: 'DELETE', json });
      yield this.session.invalidate();
    } catch (error) {
      this.setProperties({ messageKey: null, error });
    }
  }).drop(),
});
