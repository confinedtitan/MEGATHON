SEED_ACTORS = [
    {"actor_id": "PHARMACY_001", "name": "CityCare Pharmacy", "role": "Pharmacy", "location": "New York, NY"},
    {"actor_id": "PHARMACY_002", "name": "GreenCross Pharmacy", "role": "Pharmacy", "location": "Austin, TX"},
    {"actor_id": "DISTRIBUTOR_001", "name": "MediTrans Logistics", "role": "Distributor", "location": "Chicago, IL"},
    {"actor_id": "DISTRIBUTOR_002", "name": "SwiftPharma Distributors", "role": "Distributor", "location": "Atlanta, GA"},
    {"actor_id": "MANUFACTURER_001", "name": "NovaGen Labs", "role": "Manufacturer", "location": "Boston, MA"},
    {"actor_id": "REGULATOR_001", "name": "National Drug Authority", "role": "Regulator", "location": "Washington, DC"},
]

# username / password / role / actor_id / display name
SEED_USERS = [
    {"username": "pharmacy1", "password": "pharmacy123", "role": "Pharmacy", "actor_id": "PHARMACY_001", "name": "CityCare Pharmacy"},
    {"username": "pharmacy2", "password": "pharmacy123", "role": "Pharmacy", "actor_id": "PHARMACY_002", "name": "GreenCross Pharmacy"},
    {"username": "distributor1", "password": "distributor123", "role": "Distributor", "actor_id": "DISTRIBUTOR_001", "name": "MediTrans Logistics"},
    {"username": "manufacturer1", "password": "manufacturer123", "role": "Manufacturer", "actor_id": "MANUFACTURER_001", "name": "NovaGen Labs"},
    {"username": "regulator1", "password": "regulator123", "role": "Regulator", "actor_id": "REGULATOR_001", "name": "National Drug Authority"},
]

SEED_BATCHES = [
    {"batch_number": "NV-AMX-1001", "medicine_name": "Amoxicillin 500mg", "manufacturer_name": "NovaGen Labs", "expiry_date": "2027-06-30", "quantity": 5000, "target": "ACTIVE"},
    {"batch_number": "NV-PAR-1002", "medicine_name": "Paracetamol 650mg", "manufacturer_name": "NovaGen Labs", "expiry_date": "2026-11-15", "quantity": 12000, "target": "ACTIVE"},
    {"batch_number": "NV-IBU-1003", "medicine_name": "Ibuprofen 400mg", "manufacturer_name": "NovaGen Labs", "expiry_date": "2025-12-01", "quantity": 8000, "target": "LOGGED_FOR_RETURN"},
    {"batch_number": "NV-MET-1004", "medicine_name": "Metformin 850mg", "manufacturer_name": "NovaGen Labs", "expiry_date": "2026-03-20", "quantity": 6000, "target": "PICKUP_SCHEDULED"},
    {"batch_number": "NV-OMZ-1005", "medicine_name": "Omeprazole 20mg", "manufacturer_name": "NovaGen Labs", "expiry_date": "2025-09-10", "quantity": 4500, "target": "RECEIVED_BY_DISTRIBUTOR"},
    {"batch_number": "NV-AZI-1006", "medicine_name": "Azithromycin 250mg", "manufacturer_name": "NovaGen Labs", "expiry_date": "2026-01-25", "quantity": 3000, "target": "DISPUTED"},
    {"batch_number": "NV-LOS-1007", "medicine_name": "Losartan 50mg", "manufacturer_name": "NovaGen Labs", "expiry_date": "2025-08-05", "quantity": 7200, "target": "WAITING_FOR_DESTRUCTION"},
    {"batch_number": "NV-CET-1008", "medicine_name": "Cetirizine 10mg", "manufacturer_name": "NovaGen Labs", "expiry_date": "2024-12-31", "quantity": 15000, "target": "DESTROYED"},
    {"batch_number": "NV-ATOR-1009", "medicine_name": "Atorvastatin 20mg", "manufacturer_name": "NovaGen Labs", "expiry_date": "2027-02-14", "quantity": 9000, "target": "ACTIVE"},
    {"batch_number": "NV-INS-1010", "medicine_name": "Insulin Glargine 100IU", "manufacturer_name": "NovaGen Labs", "expiry_date": "2025-10-30", "quantity": 1200, "target": "DESTROYED"},
]


def path_to(target: str) -> list[str]:
    return {
        "ACTIVE": [],
        "LOGGED_FOR_RETURN": ["LOGGED_FOR_RETURN"],
        "PICKUP_SCHEDULED": ["LOGGED_FOR_RETURN", "PICKUP_SCHEDULED"],
        "RECEIVED_BY_DISTRIBUTOR": ["LOGGED_FOR_RETURN", "PICKUP_SCHEDULED", "RECEIVED_BY_DISTRIBUTOR"],
        "DISPUTED": ["LOGGED_FOR_RETURN", "PICKUP_SCHEDULED", "RECEIVED_BY_DISTRIBUTOR", "DISPUTED"],
        "WAITING_FOR_DESTRUCTION": ["LOGGED_FOR_RETURN", "PICKUP_SCHEDULED", "RECEIVED_BY_DISTRIBUTOR", "WAITING_FOR_DESTRUCTION"],
        "DESTROYED": ["LOGGED_FOR_RETURN", "PICKUP_SCHEDULED", "RECEIVED_BY_DISTRIBUTOR", "WAITING_FOR_DESTRUCTION", "DESTROYED"],
    }.get(target, [])


ACTOR_FOR_STATE = {
    "LOGGED_FOR_RETURN": ("Pharmacy", "CityCare Pharmacy", "Return logged: expired / excess stock"),
    "PICKUP_SCHEDULED": ("Distributor", "MediTrans Logistics", "Pickup scheduled with pharmacy"),
    "RECEIVED_BY_DISTRIBUTOR": ("Distributor", "MediTrans Logistics", "Batch received at distributor warehouse"),
    "DISPUTED": ("Distributor", "MediTrans Logistics", "Quantity mismatch: counted vs declared"),
    "WAITING_FOR_DESTRUCTION": ("Manufacturer", "NovaGen Labs", "Accepted for certified destruction"),
    "DESTROYED": ("Manufacturer", "NovaGen Labs", "Destroyed under supervision. Certificate issued."),
}
