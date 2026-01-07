# Backend API Documentation: Password Reset & Forgot Password

This document outlines the API endpoints required for password reset and forgot password functionality.

## Overview

Two password reset mechanisms are implemented:
1. **Reset Password**: User remembers their old password and wants to change it
2. **Forgot Password**: User forgot their password and uses date of birth for verification

---

## 1. Reset Password API

**Endpoint:** `POST /api/auth/reset-password`

**Description:** Allows a user to reset their password by providing their username, old password, and new password.

**Authentication:** Not required (public endpoint)

### Request Body

```json
{
  "username": "string (required)",
  "oldPassword": "string (required)",
  "newPassword": "string (required, min 6 characters)"
}
```

### Request Validation

- `username`: Required, must exist in the system
- `oldPassword`: Required, must match the user's current password
- `newPassword`: Required, minimum 6 characters, must be different from old password

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": null
}
```

### Error Responses

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "newPassword",
        "message": "New password must be at least 6 characters long"
      }
    ]
  }
}
```

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or old password"
  }
}
```

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with the provided username does not exist"
  }
}
```

### Implementation Notes

1. Verify that the username exists in the database
2. Verify that the old password matches the user's current password (use secure password hashing comparison)
3. Validate that the new password meets requirements (minimum 6 characters)
4. Ensure the new password is different from the old password
5. Hash the new password before storing it in the database
6. Update the user's password in the database
7. Optionally, invalidate all existing sessions/tokens for security

---

## 2. Forgot Password API

**Endpoint:** `POST /api/auth/forgot-password`

**Description:** Allows a user to reset their password when they've forgotten it, using their username and date of birth for verification.

**Authentication:** Not required (public endpoint)

### Request Body

```json
{
  "username": "string (required)",
  "dateOfBirth": "string (required, format: YYYY-MM-DD)",
  "newPassword": "string (required, min 6 characters)"
}
```

### Request Validation

- `username`: Required, must exist in the system
- `dateOfBirth`: Required, must be in `YYYY-MM-DD` format, must match the user's registered date of birth
- `newPassword`: Required, minimum 6 characters

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": null
}
```

### Error Responses

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "dateOfBirth",
        "message": "Date of birth must be in YYYY-MM-DD format"
      },
      {
        "field": "newPassword",
        "message": "New password must be at least 6 characters long"
      }
    ]
  }
}
```

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "error": {
    "code": "INVALID_VERIFICATION",
    "message": "Username or date of birth does not match our records"
  }
}
```

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with the provided username does not exist"
  }
}
```

### Implementation Notes

1. Verify that the username exists in the database
2. Verify that the provided date of birth matches the user's registered date of birth
   - Compare dates (ignore time component)
   - Handle date format conversion if needed
3. Validate that the new password meets requirements (minimum 6 characters)
4. Hash the new password before storing it in the database
5. Update the user's password in the database
6. Optionally, invalidate all existing sessions/tokens for security
7. For security, consider rate limiting this endpoint to prevent brute force attacks

---

## Database Schema Requirements

### Dealers Table

Ensure the `dealers` table has the following fields:

```sql
- id: PRIMARY KEY
- username: VARCHAR (UNIQUE, NOT NULL)
- password: VARCHAR (HASHED, NOT NULL)
- dateOfBirth: DATE (NOT NULL)
- ... (other fields)
```

### Password Storage

- Passwords must be stored as hashed values (use bcrypt, argon2, or similar)
- Never store plain text passwords
- Use salt rounds appropriate for your security requirements (recommended: 10-12 rounds for bcrypt)

---

## Security Considerations

1. **Rate Limiting**: Implement rate limiting on both endpoints to prevent brute force attacks
   - Recommended: Max 5 attempts per IP address per 15 minutes

2. **Password Requirements**: 
   - Minimum 6 characters (as per frontend validation)
   - Consider adding: uppercase, lowercase, numbers, special characters

3. **Date of Birth Verification**:
   - Compare dates only (ignore time)
   - Handle timezone considerations if applicable
   - Consider allowing small date format variations if needed

4. **Session Management**:
   - After password reset, consider invalidating all existing sessions
   - Force user to login again with new password

5. **Logging**:
   - Log all password reset attempts (successful and failed)
   - Include IP address, timestamp, and username (for security auditing)

6. **Error Messages**:
   - Don't reveal whether a username exists or not in error messages
   - Use generic messages like "Invalid credentials" to prevent user enumeration

---

## Example Implementation (Pseudocode)

### Reset Password

```javascript
async function resetPassword(req, res) {
  const { username, oldPassword, newPassword } = req.body;
  
  // Validation
  if (!username || !oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "All fields are required" }
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Password must be at least 6 characters" }
    });
  }
  
  // Find user
  const user = await db.dealers.findOne({ where: { username } });
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: "USER_NOT_FOUND", message: "User not found" }
    });
  }
  
  // Verify old password
  const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isOldPasswordValid) {
    return res.status(401).json({
      success: false,
      error: { code: "INVALID_CREDENTIALS", message: "Invalid old password" }
    });
  }
  
  // Check if new password is different
  if (oldPassword === newPassword) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "New password must be different from old password" }
    });
  }
  
  // Hash and update password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.dealers.update(
    { password: hashedPassword },
    { where: { id: user.id } }
  );
  
  // Invalidate sessions (optional)
  await invalidateUserSessions(user.id);
  
  return res.status(200).json({
    success: true,
    message: "Password reset successfully"
  });
}
```

### Forgot Password

```javascript
async function forgotPassword(req, res) {
  const { username, dateOfBirth, newPassword } = req.body;
  
  // Validation
  if (!username || !dateOfBirth || !newPassword) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "All fields are required" }
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Password must be at least 6 characters" }
    });
  }
  
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateOfBirth)) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Date of birth must be in YYYY-MM-DD format" }
    });
  }
  
  // Find user
  const user = await db.dealers.findOne({ where: { username } });
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: "USER_NOT_FOUND", message: "User not found" }
    });
  }
  
  // Verify date of birth (compare dates only, ignore time)
  const userDOB = new Date(user.dateOfBirth).toISOString().split('T')[0];
  const providedDOB = new Date(dateOfBirth).toISOString().split('T')[0];
  
  if (userDOB !== providedDOB) {
    return res.status(401).json({
      success: false,
      error: { code: "INVALID_VERIFICATION", message: "Date of birth does not match" }
    });
  }
  
  // Hash and update password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.dealers.update(
    { password: hashedPassword },
    { where: { id: user.id } }
  );
  
  // Invalidate sessions (optional)
  await invalidateUserSessions(user.id);
  
  return res.status(200).json({
    success: true,
    message: "Password reset successfully"
  });
}
```

---

## Testing Checklist

- [ ] Reset password with valid credentials
- [ ] Reset password with invalid old password
- [ ] Reset password with non-existent username
- [ ] Reset password with new password same as old password
- [ ] Reset password with new password less than 6 characters
- [ ] Forgot password with valid username and date of birth
- [ ] Forgot password with invalid date of birth
- [ ] Forgot password with non-existent username
- [ ] Forgot password with incorrect date of birth
- [ ] Rate limiting on both endpoints
- [ ] Password hashing verification
- [ ] Session invalidation after password reset

---

## Frontend Integration

The frontend is already configured to call these endpoints:

- **Reset Password**: `api.auth.resetPassword(username, oldPassword, newPassword)`
- **Forgot Password**: `api.auth.forgotPassword(username, dateOfBirth, newPassword)`

Both methods are defined in `/lib/api.ts` and will make POST requests to:
- `/api/auth/reset-password`
- `/api/auth/forgot-password`

---

## Support

For questions or issues regarding these API endpoints, please contact the development team.

