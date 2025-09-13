# Shov JavaScript SDK

JavaScript/TypeScript SDK for Shov - Instant edge key/value store.

<p align="center">
  <a href="https://shov.com" target="_blank"><strong>Website / Docs</strong></a> •
  <a href="https://github.com/shovdev" target="_blank"><img src="https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white" alt="GitHub"></a> •
  <a href="https://x.com/shovdev" target="_blank"><img src="https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white" alt="X"></a> •
  <a href="https://www.reddit.com/r/shov/" target="_blank"><img src="https://img.shields.io/badge/Reddit-FF4500?style=flat&logo=reddit&logoColor=white" alt="Reddit"></a> •
  <a href="https://discord.gg/GB3rDcFrGz" target="_blank"><img src="https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white" alt="Discord"></a>
</p>

## Installation

```bash
npm install shov-js
```

## Quick Start

```javascript
import { Shov } from 'shov-js'

const shov = new Shov({
  projectName: 'my-project',
  apiKey: 'shov_live_...'
})

// Set a value
await shov.set('hello', 'world')

// Get a value
const value = await shov.get('hello')
console.log(value) // 'world'

// Work with collections
await shov.add('users', { name: 'Alice', age: 25 })
await shov.add('users', { name: 'Bob', age: 30 })

const users = await shov.where('users')
console.log(users) // Array of user objects
```

## Configuration

### Basic Configuration

```javascript
import { Shov } from 'shov-js'

const shov = new Shov({
  projectName: 'my-project',    // Required: Your project name
  apiKey: 'shov_live_...',      // Required: Your API key
  baseUrl: 'https://shov.com'   // Optional: Custom base URL
})
```

### Environment Variables

```javascript
const shov = new Shov({
  projectName: process.env.SHOV_PROJECT,
  apiKey: process.env.SHOV_API_KEY
})
```

## API Reference

### Key-Value Operations

#### `set(key, value)`
Store a value with a key.

```javascript
await shov.set('user_count', 42)
await shov.set('config', { theme: 'dark', lang: 'en' })
```

#### `get(key)`
Retrieve a value by key.

```javascript
const count = await shov.get('user_count')
const config = await shov.get('config')
```

#### `forget(key)`
Delete a key-value pair.

```javascript
await shov.forget('old-config')
```

### Collection Operations

#### `add(collection, value)`
Add an item to a collection.

```javascript
const result = await shov.add('users', {
  name: 'Alice',
  email: 'alice@example.com',
  age: 25
})
console.log(result.id) // Item ID
```

#### `addMany(collection, items)`
Add multiple items to a collection at once.

```javascript
await shov.addMany('users', [
  { name: 'Alice', role: 'admin' },
  { name: 'Bob', role: 'user' },
  { name: 'Charlie', role: 'user' }
])
```

#### `where(collection, options)`
Find items with filters.

```javascript
const admins = await shov.where('users', {
  filter: { role: 'admin' }
})

const youngUsers = await shov.where('users', {
  filter: { age: 25 }
})

// Get all items in a collection
const allUsers = await shov.where('users')
```

#### `update(collection, id, value)`
Update an item by collection and ID.

```javascript
await shov.update('users', 'item-id-123', {
  name: 'Alice Smith',
  age: 26
})
```

#### `remove(collection, id)`
Delete an item by collection and ID.

```javascript
await shov.remove('users', 'item-id-123')
```

#### `clear(collection)`
Clear all items from a collection.

```javascript
const result = await shov.clear('temp-data')
console.log(`Cleared ${result.count} items`)
```

#### `search(query, options)`
Perform vector search across your data.

```javascript
// Search within a specific collection
const results = await shov.search('stringed instrument', { 
  collection: 'products' 
})

// Search with filters and options
const filteredResults = await shov.search('electronics', {
  collection: 'products',
  filters: { category: 'guitar', price: { $lt: 1000 } },
  topK: 5,
  minScore: 0.7
})

// Search across all collections in project
const allResults = await shov.search('musical equipment')
```

**⚠️ Important**: Vector search has eventual consistency. There is a small delay between adding data (`add`, `set`) and it becoming searchable. Plan your application logic to account for this indexing lag.

```javascript
// Example: Handle eventual consistency
const newItem = await shov.add('products', { name: 'New Guitar', type: 'Electric' })

// ❌ This may not find the new item immediately
const results = await shov.search('New Guitar') // May return empty

// ✅ Better: Use direct queries for immediate access
const item = await shov.getItem(newItem.id) // Always works immediately

// ✅ Or implement retry logic for search
async function searchWithRetry(query, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const results = await shov.search(query)
    if (results.length > 0) return results
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s
  }
  return []
}
```

### File Operations

#### `upload(file)`
Upload a file directly.

```javascript
// Upload a file from file input
const fileInput = document.querySelector('input[type="file"]')
const file = fileInput.files[0]
const result = await shov.upload(file)
console.log(result.url) // File URL
```

#### `getUploadUrl(fileName, mimeType?)`
Get a pre-signed URL for client-side file uploads.

```javascript
const { uploadUrl, fileId } = await shov.getUploadUrl('document.pdf', 'application/pdf')

// Use the upload URL for client-side upload
const file = document.querySelector('input[type="file"]').files[0]
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type }
})
```

#### `forgetFile(filename)`
Delete a file.

```javascript
await shov.forgetFile('old-document.pdf')
```

### Authentication Operations

#### `sendOtp(identifier)`
Send a one-time password to an identifier.

```javascript
await shov.sendOtp('user@example.com')
```

#### `verifyOtp(identifier, pin)`
Verify a one-time password.

```javascript
const result = await shov.verifyOtp('user@example.com', '1234')
if (result.success) {
  console.log('PIN verified successfully')
}
```

### Utility Operations

#### `getContents()`
List all items in the project.

```javascript
const contents = await shov.getContents()
console.log(contents.contents) // Array of all items
```

## Error Handling

The SDK throws `ShovError` for API errors:

```javascript
import { Shov, ShovError } from 'shov-js'

try {
  await shov.get('nonexistent-key')
} catch (error) {
  if (error instanceof ShovError) {
    console.log('Error:', error.message)
    console.log('Status:', error.statusCode)
  }
}
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions:

```typescript
import { Shov, ShovItem, ShovConfig } from 'shov-js'

const config: ShovConfig = {
  projectName: 'my-project',
  apiKey: 'shov_live_...'
}

const shov = new Shov(config)

// Typed responses
const value = await shov.get('my-key')
const users = await shov.where('users')
```

## Framework Integration

### Next.js

```javascript
// lib/shov.js
import { Shov } from 'shov-js'

export const shov = new Shov({
  projectName: process.env.SHOV_PROJECT,
  apiKey: process.env.SHOV_API_KEY
})

// pages/api/users.js
import { shov } from '../../lib/shov'

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const user = await shov.add('users', req.body)
      res.json(user)
    } else {
      const users = await shov.where('users')
      res.json(users)
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```

### React

```javascript
import { useEffect, useState } from 'react'
import { shov } from '../lib/shov'

function UserList() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await shov.where('users')
        setUsers(data)
      } catch (error) {
        console.error('Failed to load users:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUsers()
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.value.name}</li>
      ))}
    </ul>
  )
}
```

### Express.js

```javascript
import express from 'express'
import { Shov } from 'shov-js'

const app = express()
const shov = new Shov({
  projectName: process.env.SHOV_PROJECT,
  apiKey: process.env.SHOV_API_KEY
})

app.use(express.json())

app.get('/api/users', async (req, res) => {
  try {
    const users = await shov.where('users')
    res.json(users)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/users', async (req, res) => {
  try {
    const user = await shov.add('users', req.body)
    res.json(user)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

## Best Practices

### 1. Environment Configuration
Always use environment variables for sensitive data:

```javascript
// ✅ Good
const shov = new Shov({
  projectName: process.env.SHOV_PROJECT,
  apiKey: process.env.SHOV_API_KEY
})

// ❌ Bad
const shov = new Shov({
  projectName: 'my-project',
  apiKey: 'shov_live_hardcoded_key'
})
```

### 2. Error Handling
Always handle errors appropriately:

```javascript
try {
  const users = await shov.list('users')
  return users
} catch (error) {
  console.error('Failed to fetch users:', error)
  return []
}
```

### 3. Batch Operations
Use batch operations for better performance:

```javascript
// ✅ Good - batch operation
const values = await shov.getMany(['key1', 'key2', 'key3'])

// ❌ Bad - sequential operations
const value1 = await shov.get('key1')
const value2 = await shov.get('key2')
const value3 = await shov.get('key3')
```

### 4. Data Validation
Validate data before storing:

```javascript
function validateUser(user) {
  if (!user.name || !user.email) {
    throw new Error('Name and email are required')
  }
  if (!user.email.includes('@')) {
    throw new Error('Invalid email format')
  }
}

// Use validation
try {
  validateUser(userData)
  await shov.add('users', userData)
} catch (error) {
  console.error('Validation failed:', error.message)
}
```

## Support

- **Issues**: [GitHub Issues](https://github.com/shovdev/shov-js/issues)

## License

MIT
