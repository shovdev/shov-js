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
  project: 'my-project',
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
  project: 'my-project',        // Required: Your project name
  apiKey: 'shov_live_...',      // Required: Your API key
  baseUrl: 'https://shov.com'   // Optional: Custom base URL
})
```

### Environment Variables

```javascript
const shov = new Shov({
  project: process.env.SHOV_PROJECT,
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

#### `getItem(key)`
Get full item data including metadata.

```javascript
const item = await shov.getItem('user_count')
console.log(item)
// {
//   id: '...',
//   name: 'user_count',
//   value: 42,
//   created_at: '2024-01-01T00:00:00Z',
//   updated_at: '2024-01-01T00:00:00Z'
// }
```

#### `exists(key)`
Check if a key exists.

```javascript
const exists = await shov.exists('user_count')
console.log(exists) // true or false
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

#### `list(collection, options?)`
List items in a collection.

```javascript
// List all items
const users = await shov.list('users')

// With options
const recentUsers = await shov.list('users', {
  limit: 10,
  sort: 'desc'
})
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

#### `update(id, value)`
Update an item by ID.

```javascript
await shov.update('item-id-123', {
  name: 'Alice Smith',
  age: 26
})
```

#### `remove(id)`
Delete an item by ID.

```javascript
await shov.remove('item-id-123')
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

#### `search(query, options)`
Perform vector search across your data.

```javascript
// Search within a specific collection
const results = await shov.search('stringed instrument', { 
  collection: 'products' 
})

// Search across all collections in project
const allResults = await shov.search('musical equipment')
```

### Batch Operations

#### `getMany(keys)`
Get multiple values at once.

```javascript
const values = await shov.getMany(['key1', 'key2', 'key3'])
console.log(values)
// { key1: 'value1', key2: 'value2', key3: null }
```

#### `setMany(data)`
Set multiple key-value pairs at once.

```javascript
const results = await shov.setMany({
  key1: 'value1',
  key2: 'value2',
  key3: 'value3'
})
console.log(results)
// { key1: 'id1', key2: 'id2', key3: 'id3' }
```

### Utility Operations

#### `increment(key, amount?)`
Increment a numeric value.

```javascript
await shov.set('counter', 5)
const newValue = await shov.increment('counter', 3)
console.log(newValue) // 8

// Default increment by 1
await shov.increment('views')
```

#### `decrement(key, amount?)`
Decrement a numeric value.

```javascript
const newValue = await shov.decrement('counter', 2)
console.log(newValue) // 6
```

#### `append(key, value)`
Append to an array value.

```javascript
await shov.set('tags', ['javascript', 'web'])
const newTags = await shov.append('tags', 'nodejs')
console.log(newTags) // ['javascript', 'web', 'nodejs']
```

#### `remove(key, value)`
Remove from an array value.

```javascript
const newTags = await shov.remove('tags', 'web')
console.log(newTags) // ['javascript', 'nodejs']
```

#### `stats(collection)`
Get collection statistics.

```javascript
const stats = await shov.stats('users')
console.log(stats)
// { count: 150, size: 45230 }
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
  project: 'my-project',
  apiKey: 'sk_live_...'
}

const shov = new Shov(config)

// Typed responses
const item: ShovItem = await shov.getItem('my-key')
const users: ShovItem[] = await shov.list('users')
```

## Framework Integration

### Next.js

```javascript
// lib/shov.js
import { Shov } from 'shov-js'

export const shov = new Shov({
  project: process.env.SHOV_PROJECT,
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
      const users = await shov.list('users')
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
        const data = await shov.list('users')
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
  project: process.env.SHOV_PROJECT,
  apiKey: process.env.SHOV_API_KEY
})

app.use(express.json())

app.get('/api/users', async (req, res) => {
  try {
    const users = await shov.list('users')
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
  project: process.env.SHOV_PROJECT,
  apiKey: process.env.SHOV_API_KEY
})

// ❌ Bad
const shov = new Shov({
  project: 'my-project',
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
