"""ensure_tax_rate_and_payment_method

Revision ID: bc9bc597394b
Revises: 27e2a87263e9
Create Date: 2026-05-02 12:24:39.635005

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bc9bc597394b'
down_revision = '27e2a87263e9'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = insp.get_columns(table_name)
    return any(c['name'] == column_name for c in columns)

def upgrade() -> None:
    # Safe check for products.tax_rate
    if not column_exists('products', 'tax_rate'):
        with op.batch_alter_table('products') as batch_op:
            batch_op.add_column(sa.Column('tax_rate', sa.Float(), nullable=False, server_default='18.0'))
    
    # Safe check for sale_orders.payment_method
    if not column_exists('sale_orders', 'payment_method'):
        with op.batch_alter_table('sale_orders') as batch_op:
            batch_op.add_column(sa.Column('payment_method', sa.String(20), nullable=False, server_default='CASH'))

def downgrade() -> None:
    pass


