#!/usr/bin/python

import sys

from sqlalchemy import desc, literal_column, cast, Integer

from skylines.config import environment
from skylines import model


NULL = literal_column(str(0))


def ilike_as_int(column, value, weight):
    # Make sure weight is numeric and we can safely
    # pass it to the literal_column()
    assert isinstance(weight, (int, float))

    # Convert weight to a literal_column()
    weight = literal_column(str(weight))

    # Return ilike expression
    return cast(column.ilike(value), Integer) * weight


def ilikes_as_int(col_vals):
    return sum([ilike_as_int(col, val, rel) for col, val, rel in col_vals], NULL)


environment.load_from_file()

tokens = sys.argv[1:]

session = model.DBSession


def get_query(type, model, query_attr, tokens):
    query_attr = getattr(model, query_attr)

    col_vals = []

    # Matches token exactly
    col_vals.extend([(query_attr, '{}'.format(token), len(token) * 5) for token in tokens])
    # Begins with token
    col_vals.extend([(query_attr, '{}%'.format(token), len(token) * 3) for token in tokens])
    # Has token at word start
    col_vals.extend([(query_attr, '% {}%'.format(token), len(token) * 2) for token in tokens])
    # Has token
    col_vals.extend([(query_attr, '%{}%'.format(token), len(token)) for token in tokens])

    weight = ilikes_as_int(col_vals)

    # The search result type
    type = literal_column('\'{}\''.format(type))

    return session.query(type.label('type'),
                         model.id.label('id'),
                         query_attr.label('name'),
                         weight.label('weight')).filter(weight > NULL)


def search_query(tokens):
    if len(tokens) > 1:
        tokens.append(' '.join(tokens))

    q1 = get_query('user', model.User, 'name', tokens)
    q2 = get_query('club', model.Club, 'name', tokens)
    q3 = get_query('airport', model.Airport, 'name', tokens)

    return q1.union(q2, q3).order_by(desc('weight'))

for u in search_query(tokens).limit(20):
    print u
