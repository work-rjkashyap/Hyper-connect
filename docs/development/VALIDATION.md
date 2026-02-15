# Validation with Zod & Validator

This guide shows how to use validation in Hyper Connect.

## Frontend Validation (Zod)

### Installation
```bash
npm install zod
```

### Basic Usage in Components

#### Form Validation Example

```typescript
import { z } from 'zod';
import { useState } from 'react';

const deviceNameSchema = z.object({
  deviceName: z
    .string()
    .min(1, 'Device name is required')
    .max(50, 'Name too long'),
});

function OnboardingForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    const result = deviceNameSchema.safeParse({
      deviceName: formData.get('deviceName'),
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Valid data
    console.log(result.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="deviceName" />
      {errors.deviceName && <span>{errors.deviceName}</span>}
      <button type="submit">Submit</button>
    </form>
  );
}
```

#### API Response Validation

```typescript
import { invoke } from '@tauri-apps/api/core';
import { deviceSchema } from './schemas/validation';

async function fetchDevices() {
  try {
    const rawData = await invoke('get_devices');

    // Validate the response
    const result = deviceSchema.array().safeParse(rawData);

    if (!result.success) {
      console.error('Invalid device data:', result.error);
      return [];
    }

    // Type-safe data
    return result.data;
  } catch (error) {
    console.error('Failed to fetch devices:', error);
    return [];
  }
}
```

#### Real-time Validation

```typescript
import { z } from 'zod';
import { useState } from 'react';

const messageSchema = z.string().min(1).max(5000);

function ChatInput() {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setInput(value);

    const result = messageSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.errors[0].message);
    } else {
      setError(null);
    }
  };

  return (
    <div>
      <input
        value={input}
        onChange={(e) => handleChange(e.target.value)}
      />
      {error && <span className="error">{error}</span>}
    </div>
  );
}
```

### Advanced Zod Patterns

#### Conditional Validation

```typescript
const transferSchema = z.object({
  type: z.enum(['send', 'receive']),
  filePath: z.string().optional(),
  fileSize: z.number().positive().optional(),
}).refine((data) => {
  if (data.type === 'send') {
    return !!data.filePath && !!data.fileSize;
  }
  return true;
}, {
  message: 'File path and size required for sending',
});
```

#### Transforming Data

```typescript
const portSchema = z.string()
  .regex(/^\d+$/, 'Must be a number')
  .transform((val) => parseInt(val, 10))
  .refine((val) => val >= 1024 && val <= 65535, {
    message: 'Port must be between 1024 and 65535',
  });
```

## Backend Validation (Rust)

### Installation
Add to `Cargo.toml`:
```toml
validator = { version = "0.18", features = ["derive"] }
```

### Basic Usage in Tauri Commands

#### Validated Command

```rust
use validator::Validate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Validate)]
struct CreateMessageInput {
    #[validate(length(min = 1, max = 5000))]
    content: String,

    #[validate(length(equal = 36))]
    to_device_id: String,
}

#[tauri::command]
fn create_message(input: CreateMessageInput) -> Result<String, String> {
    // Validate input
    input.validate()
        .map_err(|e| format!("Validation failed: {}", e))?;

    // Process valid data
    Ok("Message created".to_string())
}
```

#### Nested Validation

```rust
#[derive(Debug, Validate)]
struct Address {
    #[validate(length(min = 1, max = 100))]
    street: String,

    #[validate(range(min = 1, max = 99999))]
    zip_code: u32,
}

#[derive(Debug, Validate)]
struct User {
    #[validate(length(min = 1, max = 50))]
    name: String,

    #[validate]
    address: Address,
}
```

#### Custom Validators

```rust
use validator::{Validate, ValidationError};

fn validate_filename(filename: &str) -> Result<(), ValidationError> {
    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

    if filename.chars().any(|c| invalid_chars.contains(&c)) {
        return Err(ValidationError::new("invalid_filename"));
    }

    Ok(())
}

#[derive(Debug, Validate)]
struct FileUpload {
    #[validate(custom = "validate_filename")]
    #[validate(length(min = 1, max = 255))]
    filename: String,

    #[validate(range(min = 1, max = 10_000_000_000))] // Max 10GB
    size: u64,
}
```

### Integration with Existing Code

#### Example: Enhanced Message Creation

```rust
// In messaging.rs
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct ValidatedMessageInput {
    #[validate(length(min = 1, max = 5000))]
    pub content: String,
}

#[tauri::command]
pub fn send_validated_message(
    state: State<AppState>,
    from_device_id: String,
    to_device_id: String,
    input: ValidatedMessageInput,
    app_handle: AppHandle,
) -> Result<Message, String> {
    // Validate input
    input.validate()
        .map_err(|e| format!("Invalid message: {}", e))?;

    let message_type = MessageType::Text {
        content: input.content
    };

    let messaging = state.messaging.lock().unwrap();
    messaging.send_message(
        from_device_id,
        to_device_id,
        message_type,
        None,
        app_handle
    )
}
```

#### Example: File Transfer Validation

```rust
// In file_transfer.rs
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct ValidatedFileTransferInput {
    #[validate(length(min = 1, max = 255))]
    filename: String,

    #[validate(length(min = 1))]
    file_path: String,

    #[validate(length(equal = 36))]
    from_device_id: String,

    #[validate(length(equal = 36))]
    to_device_id: String,
}

#[tauri::command]
pub fn create_validated_transfer(
    state: State<AppState>,
    input: ValidatedFileTransferInput,
) -> Result<FileTransfer, String> {
    input.validate()
        .map_err(|e| format!("Invalid transfer: {}", e))?;

    let file_transfer = state.file_transfer.lock().unwrap();
    file_transfer.create_transfer(
        input.filename,
        input.file_path,
        input.from_device_id,
        input.to_device_id,
    )
}
```

## Best Practices

### Frontend (Zod)
1. **Define schemas once, reuse everywhere**
2. **Use `safeParse` for user input** (doesn't throw)
3. **Use `parse` for internal data** (throws on error)
4. **Generate TypeScript types** from schemas with `z.infer<>`
5. **Validate API responses** before using them

### Backend (Rust)
1. **Validate at API boundaries** (Tauri commands)
2. **Use `#[validate]` for nested structs**
3. **Write custom validators** for complex logic
4. **Return user-friendly errors** from validation
5. **Combine with `Result<T, E>`** pattern

## Testing Validation

### Frontend Test
```typescript
import { describe, it, expect } from 'vitest';
import { deviceNameSchema } from './validation';

describe('Device Name Validation', () => {
  it('should accept valid names', () => {
    const result = deviceNameSchema.parse({
      deviceName: 'My MacBook'
    });
    expect(result.deviceName).toBe('My MacBook');
  });

  it('should reject empty names', () => {
    expect(() => {
      deviceNameSchema.parse({ deviceName: '' });
    }).toThrow();
  });
});
```

### Backend Test
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_valid_message() {
        let input = CreateMessageInput {
            content: "Hello".to_string(),
            to_device_id: "12345678-1234-1234-1234-123456789012".to_string(),
        };

        assert!(input.validate().is_ok());
    }

    #[test]
    fn test_invalid_message() {
        let input = CreateMessageInput {
            content: "".to_string(),
            to_device_id: "invalid".to_string(),
        };

        assert!(input.validate().is_err());
    }
}
```

## Common Validation Patterns

### Email
```typescript
// Zod
const emailSchema = z.string().email();

// Rust
#[validate(email)]
email: String,
```

### URL
```typescript
// Zod
const urlSchema = z.string().url();

// Rust
#[validate(url)]
url: String,
```

### UUID
```typescript
// Zod
const uuidSchema = z.string().uuid();

// Rust
#[validate(length(equal = 36))]
// or use uuid crate's types directly
```

### Port Number
```typescript
// Zod
const portSchema = z.number().int().min(1).max(65535);

// Rust
#[validate(range(min = 1, max = 65535))]
port: u16,
```

### File Size
```typescript
// Zod
const fileSizeSchema = z.number().positive().max(10_000_000); // 10MB

// Rust
#[validate(range(min = 1, max = 10_000_000))]
file_size: u64,
```

## Resources

- [Zod Documentation](https://zod.dev/)
- [Validator Crate Docs](https://docs.rs/validator/)
- [Tauri Commands](https://tauri.app/develop/calling-rust/)
