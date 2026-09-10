from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import get_settings

settings = get_settings()

db_url = settings.DATABASE_URL
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

try:
    engine = create_engine(db_url, pool_pre_ping=True, connect_args=connect_args)
    # Test connection to ensure DB is available and password is valid
    with engine.connect() as conn:
        pass
except Exception as e:
    print(f"PostgreSQL connection to {db_url} failed ({e}). Falling back to local SQLite database (sqlite:///./pharma.db).")
    db_url = "sqlite:///./pharma.db"
    engine = create_engine(db_url, pool_pre_ping=True, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

