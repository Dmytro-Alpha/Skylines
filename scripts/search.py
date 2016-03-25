#!/usr/bin/python

import sys

from sqlalchemy import desc, literal_column

from skylines.config import environment
from skylines import model


NULL = literal_column(str(0))

environment.load_from_file()

tokens = sys.argv[1:]

session = model.DBSession


def weight_expression(column, tokens):
    weighted_ilikes = []

    for token in tokens:
        len_token = len(token)

        def add_pattern(pattern, weight):
            weighted_ilikes.append(
                column.weighted_ilike(pattern.format(token), weight))

        # Matches token exactly
        add_pattern('{}', len_token * 5)
        # Begins with token
        add_pattern('{}%', len_token * 3)
        # Has token at word start
        add_pattern('% {}%', len_token * 2)
        # Has token
        add_pattern('%{}%', len_token)

    return sum(weighted_ilikes, NULL)


def get_query(model, query_attr, tokens):
    query_attr = getattr(model, query_attr)

    weight = weight_expression(query_attr, tokens)

    # The search result table
    table = literal_column('\'{}\''.format(model.__tablename__))

    return session.query(table.label('table'),
                         model.id.label('id'),
                         query_attr.label('name'),
                         weight.label('weight')).filter(weight > NULL)


def search_query(tokens):
    # Escape % and _ properly
    tokens = [t.replace('%', '\%').replace('_', '\_') for t in tokens]

    # Use * as wildcard character
    tokens = [t.replace('*', '%') for t in tokens]

    if len(tokens) > 1:
        tokens.append(' '.join(tokens))

    q1 = get_query(model.User, 'name', tokens)
    q2 = get_query(model.Club, 'name', tokens)
    q3 = get_query(model.Airport, 'name', tokens)

    return q1.union(q2, q3).order_by(desc('weight'))

for u in search_query(tokens).limit(20):
    print u
