from enum import StrEnum


class UserRole(StrEnum):
    ADMIN = "admin"
    OPERATOR = "operator"


class ReservationStatus(StrEnum):
    SCHEDULED = "AGENDADA"
    CONFIRMED = "CONFIRMADA"
    ARRIVED = "CHEGOU"
    CANCELLED = "CANCELADA"


class ReservationOrigin(StrEnum):
    PHONE = "TELEFONE"
    WHATSAPP = "WHATSAPP"
    IN_PERSON = "PRESENCIAL"
    TAGME = "TAGME"
    OTHER = "OUTRO"


class PasswordTokenPurpose(StrEnum):
    FIRST_ACCESS = "FIRST_ACCESS"
    PASSWORD_RESET = "PASSWORD_RESET"


class ReservationAction(StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    CONFIRM = "CONFIRM"
    CHECK_IN = "CHECK_IN"
    UNDO_CHECK_IN = "UNDO_CHECK_IN"
    CANCEL = "CANCEL"
    TABLE_CHANGE = "TABLE_CHANGE"
