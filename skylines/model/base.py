from sqlalchemy import literal_column, desc
from sqlalchemy.ext.declarative import declarative_base

from .session import DBSession
from .search import weight_expression


class _BaseClass(object):
    @classmethod
    def query(cls, **kw):
        q = DBSession.query(cls)

        if kw:
            q = q.filter_by(**kw)

        return q

    @classmethod
    def get(cls, id):
        return cls.query().get(id)

    @classmethod
    def search_query(cls, tokens,
                     weight_func=None, include_misses=False, ordered=True):

        # Read the searchable columns from the table (strings)
        columns = cls.__searchable_columns__

        # Convert the columns from strings into column objects
        columns = [getattr(cls, c) for c in columns]

        # The model name that can be used to match search result to model
        cls_name = literal_column('\'{}\''.format(cls.__name__))

        # Generate the search weight expression from the
        # searchable columns, tokens and patterns
        if not weight_func:
            weight_func = weight_expression

        weight = weight_func(columns, tokens)

        # Create a query object
        query = DBSession.query(
            cls_name.label('model'), cls.id.label('id'),
            cls.name.label('name'), weight.label('weight'))

        # Filter out results that don't match the patterns at all (optional)
        if not include_misses:
            query = query.filter(weight > 0)

        # Order by weight (optional)
        if ordered:
            query = query.order_by(desc(weight))

        return query


# Base class for all of our model classes: By default, the data model is
# defined with SQLAlchemy's declarative extension, but if you need more
# control, you can switch to the traditional method.
DeclarativeBase = declarative_base(cls=_BaseClass)

# There are two convenient ways for you to spare some typing.
# You can have a query property on all your model classes by doing this:
# DeclarativeBase.query = DBSession.query_property()
# Or you can use a session-aware mapper as it was used in TurboGears 1:
# DeclarativeBase = declarative_base(mapper=DBSession.mapper)

# Global metadata.
# The default metadata is the one from the declarative base.
metadata = DeclarativeBase.metadata
