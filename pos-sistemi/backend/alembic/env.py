"""
Alembic Environment Configuration
"""

import sys
from pathlib import Path

# Backend src klasörünü path'e ekle
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path / 'src'))

from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import Base and all models
from src.shared.database.base import Base
from src.shared.config.settings import get_settings

# Import all models for Alembic autogenerate
from src.features.auth.models import User  # noqa
from src.features.customers.models import Customer  # noqa
from src.features.ecommerce.models import MarketplaceConfig, ProductMapping  # noqa
from src.features.inventory.models import Category, Product  # noqa
from src.features.inventory.stock_movement import StockMovement  # noqa
from src.features.orders.models import Order, OrderItem  # noqa
from src.features.personnel.models import Employee, EmployeeAdvance  # noqa
from src.features.sales.models import SaleOrder, SaleOrderItem  # noqa
from src.features.settings.models import Setting  # noqa
from src.features.system.models import SystemLog  # noqa
from src.features.transactions.models import Transaction  # noqa

# Get database path from settings
settings = get_settings()
if settings.DATABASE_PATH:
    # SQLite için path'i düzenle
    db_path = settings.DATABASE_PATH.replace('\\', '/')
    config.set_main_option('sqlalchemy.url', f'sqlite:///{db_path}')

# target_metadata is used for autogenerate support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()


