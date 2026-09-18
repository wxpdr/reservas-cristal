from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordRequest(BaseModel):
    email: EmailStr


class PasswordCompletion(BaseModel):
    token: str = Field(min_length=20)
    password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str
