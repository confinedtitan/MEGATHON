"""Backend state machine. DESTROYED is a permanent terminal state."""

STATUSES = [
    "ACTIVE",
    "LOGGED_FOR_RETURN",
    "PICKUP_SCHEDULED",
    "RECEIVED_BY_DISTRIBUTOR",
    "DISPUTED",
    "WAITING_FOR_DESTRUCTION",
    "DESTROYED",
]

NON_SELLABLE = [
    "LOGGED_FOR_RETURN",
    "PICKUP_SCHEDULED",
    "RECEIVED_BY_DISTRIBUTOR",
    "DISPUTED",
    "WAITING_FOR_DESTRUCTION",
    "DESTROYED",
]

ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "ACTIVE": ["LOGGED_FOR_RETURN"],
    "LOGGED_FOR_RETURN": ["PICKUP_SCHEDULED"],
    "PICKUP_SCHEDULED": ["RECEIVED_BY_DISTRIBUTOR", "DISPUTED"],
    "RECEIVED_BY_DISTRIBUTOR": ["WAITING_FOR_DESTRUCTION", "DISPUTED"],
    "DISPUTED": ["RECEIVED_BY_DISTRIBUTOR"],
    "WAITING_FOR_DESTRUCTION": ["DESTROYED"],
    "DESTROYED": [],
}

EVENT_FOR_STATE = {
    "ACTIVE": "BATCH_CREATED",
    "LOGGED_FOR_RETURN": "LOGGED_FOR_RETURN",
    "PICKUP_SCHEDULED": "PICKUP_SCHEDULED",
    "RECEIVED_BY_DISTRIBUTOR": "RECEIVED_BY_DISTRIBUTOR",
    "DISPUTED": "DISPUTE_RAISED",
    "WAITING_FOR_DESTRUCTION": "WAITING_FOR_DESTRUCTION",
    "DESTROYED": "DESTRUCTION_VERIFIED",
}


def check_transition(from_state: str, to_state: str) -> None:
    from fastapi import HTTPException

    if from_state not in STATUSES:
        raise HTTPException(status_code=422, detail=f"Unknown state: {from_state}")
    if to_state not in STATUSES:
        raise HTTPException(status_code=422, detail=f"Unknown state: {to_state}")
    if from_state == "DESTROYED":
        raise HTTPException(
            status_code=422,
            detail="DESTROYED is terminal — no further transitions allowed",
        )
    if to_state not in ALLOWED_TRANSITIONS.get(from_state, []):
        raise HTTPException(
            status_code=422,
            detail=f"Transition {from_state} -> {to_state} is forbidden",
        )
