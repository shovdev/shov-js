# Shov JavaScript SDK

JavaScript/TypeScript SDK for Shov - The backend for
AI-coded apps with vector search, edge functions, and real-time streaming.

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
await shov.add('users', { name: 'Alice', age: 25, role: 'admin' })
await shov.add('users', { name: 'Bob', age: 30, role: 'user' })

// Advanced filtering with operators
const adults = await shov.where('users', { 
  filter: { age: { $gte: 18 }, role: { $in: ['admin', 'moderator'] } } 
})

// Count items in collections
const totalUsers = await shov.count('users')
const adminCount = await shov.count('users', { filter: { role: 'admin' } })

// Vector search with advanced filters
const results = await shov.search('find Alice', { 
  collection: 'users',
  filters: { role: 'admin', age: { $between: [20, 35] } }
})

// Real-time streaming
const { eventSource, close } = await shov.subscribe([
  { collection: 'users' },
  { channel: 'notifications' }
], {
  onMessage: (data) => console.log('Update:', data)
})
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

## Performance

Shov delivers exceptional performance from 300+ global edge locations:

- **Cached Reads**: ~4ms globally (19x faster than Supabase, 10x faster than MongoDB)
- **Complex Queries**: ~8ms per operation (8.7x faster than Supabase, 5.6x faster than MongoDB)  
- **Edge Functions**: ~68ms globally (hot cached functions + data)
- **Vector Search**: ~100ms globally with automatic embeddings
- **Real-time Streaming**: <100ms message delivery to active subscribers

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

#### `count(collection, options)`
Count items in a collection with optional filtering.

```javascript
// Count all items in a collection
const totalUsers = await shov.count('users')
console.log('Total users:', totalUsers.count)

// Count with filters
const adminCount = await shov.count('users', {
  filter: { role: 'admin' }
})

// Count with advanced filters
const activeAdults = await shov.count('users', {
  filter: { 
    age: { $gte: 18 }, 
    status: 'active',
    role: { $in: ['admin', 'moderator'] }
  }
})
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

#### `batch(operations)`
Execute multiple operations atomically in a single transaction.

```javascript
// Execute multiple operations atomically
const result = await shov.batch([
  { type: 'set', name: 'user:123', value: { name: 'John', email: 'john@example.com' } },
  { type: 'add', collection: 'orders', value: { userId: '123', total: 99.99 } },
  { type: 'update', collection: 'inventory', id: 'item-456', value: { stock: 10 } }
])

// E-commerce checkout example (atomic transaction)
const checkoutResult = await shov.batch([
  { type: 'add', collection: 'orders', value: { userId: '123', items: [{ id: 'prod-1', qty: 2 }], total: 199.98 } },
  { type: 'update', collection: 'inventory', id: 'prod-1', value: { stock: 8 } },
  { type: 'set', name: 'user:123:last_order', value: 'order-abc123' }
])

// Read-your-writes consistency
const consistencyResult = await shov.batch([
  { type: 'set', name: 'counter', value: 1 },
  { type: 'get', name: 'counter' },
  { type: 'set', name: 'counter', value: 2 }
])

console.log(result.transactionId) // Transaction ID
console.log(result.results) // Array of individual operation results
```

**Supported operation types:**
- `set` - Set key-value pairs
- `get` - Read values (for read-your-writes consistency)
- `add` - Add items to collections
- `update` - Update collection items by ID
- `remove` - Remove collection items by ID
- `forget` - Delete keys
- `clear` - Clear entire collections

**⚠️ Important**: All operations in a batch are executed atomically. If any operation fails, the entire batch is rolled back and no changes are made.

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
const items = await shov.where('products', { filter: { id: newItem.id } }) // Always works immediately

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

### Edge Functions Operations

#### `listEdgeFunctions()`
List all deployed edge functions.

```javascript
const functions = await shov.listEdgeFunctions()
console.log('Deployed functions:', functions)
```

#### `createEdgeFunction(name, code)`
Deploy a JavaScript function to the global edge network.

```javascript
const functionCode = `
export default async function(request, env, ctx) {
  return new Response(JSON.stringify({
    message: "Hello from the edge!",
    timestamp: new Date().toISOString()
  }));
}
`;

const result = await shov.createEdgeFunction('hello-world', functionCode)
console.log('Function deployed:', result.url)
```

#### `updateEdgeFunction(name, code)`
Update an existing edge function with new code.

```javascript
const updatedCode = `
export default async function(request, env, ctx) {
  return new Response(JSON.stringify({
    message: "Updated from SDK",
    version: 2
  }));
}
`;

const result = await shov.updateEdgeFunction('hello-world', updatedCode)
console.log('Function updated:', result.url)
```

#### `deleteEdgeFunction(name)`
Delete an edge function from the global network.

```javascript
await shov.deleteEdgeFunction('hello-world')
console.log('Function deleted successfully')
```

#### `rollbackEdgeFunction(name, version?)`
Rollback an edge function to a previous version.

```javascript
// Rollback to previous version
const result = await shov.rollbackEdgeFunction('hello-world')
console.log('Rolled back to version:', result.version)

// Rollback to specific version
const specificResult = await shov.rollbackEdgeFunction('hello-world', 3)
console.log('Rolled back to version:', specificResult.version)
```

#### `getEdgeFunctionLogs(name?)`
Get logs from your edge functions.

```javascript
// Get recent logs from all functions
const logs = await shov.getEdgeFunctionLogs()
console.log('Recent logs:', logs)

// Get logs from specific function
const functionLogs = await shov.getEdgeFunctionLogs('hello-world')
console.log('Function logs:', functionLogs)
```

### Secrets Management Operations

#### `listSecrets()`
List all secret names (values are never returned for security).

```javascript
const secrets = await shov.listSecrets()
console.log('Secret names:', secrets.secrets)
```

#### `setSecret(name, value, functions?)`
Set a secret for edge functions.

```javascript
// Set a secret for all functions
await shov.setSecret('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db')

// Set a secret for specific functions
await shov.setSecret('API_KEY', 'sk_live_abc123', ['user-auth', 'payment-api'])
```

#### `setManySecrets(secrets, functions?)`
Set multiple secrets at once (bulk operation).

```javascript
const secrets = [
  { name: 'DATABASE_URL', value: 'postgresql://user:pass@localhost:5432/db' },
  { name: 'REDIS_URL', value: 'redis://localhost:6379' },
  { name: 'JWT_SECRET', value: 'super-secret-jwt-key' }
]

const result = await shov.setManySecrets(secrets)
console.log('Set secrets:', result.secretNames)
```

#### `deleteSecret(name, functions?)`
Delete a secret from edge functions.

```javascript
// Delete a secret from all functions
await shov.deleteSecret('OLD_API_KEY')

// Delete from specific functions
await shov.deleteSecret('TEMP_TOKEN', ['test-api', 'dev-webhook'])
```

### Utility Operations

#### `contents()`
List all items in the project.

```javascript
const contents = await shov.contents()
console.log(contents.contents) // Array of all items
```

### Real-time Streaming Operations

#### `createToken(type, subscriptions, options?)`
Create a temporary token for client-side operations.

```javascript
// Create a streaming token for browser-side connections
const token = await shov.createToken('streaming', [
  { collection: 'users', filters: { status: 'active' } },
  { key: 'config' },
  { channel: 'notifications' }
], { expires_in: 3600 })

console.log(token.token) // Use this token for streaming
```

#### `subscribe(subscriptions, options?)`
Subscribe to real-time updates using Server-Sent Events.

```javascript
// Subscribe to multiple data sources
const { eventSource, close } = await shov.subscribe([
  { collection: 'users' },                    // All user changes
  { collection: 'orders', filters: { status: 'pending' } }, // Filtered orders
  { key: 'config' },                          // Config key changes
  { channel: 'notifications' }                // Custom channel messages
], {
  onMessage: (data) => {
    if (data.type === 'message') {
      console.log('Data update:', data.data)
    }
  },
  onError: (error) => {
    console.error('Stream error:', error)
  },
  onOpen: () => {
    console.log('Connected to real-time stream')
  },
  expires_in: 7200  // Token expiration (default: 3600)
})

// Close the connection when done
// close()
```

#### `broadcast(subscription, message)`
Broadcast a message to active subscribers.

```javascript
// Broadcast to collection subscribers
await shov.broadcast(
  { collection: 'users', filters: { role: 'admin' } },
  { type: 'alert', text: 'System maintenance in 5 minutes' }
)

// Broadcast to key subscribers
await shov.broadcast(
  { key: 'config' },
  { theme: 'dark', updated_at: new Date().toISOString() }
)

// Broadcast to channel subscribers
await shov.broadcast(
  { channel: 'notifications' },
  { user: 'Alice', message: 'Hello everyone!' }
)
```

**Real-time Features:**
- **Auto-broadcasts**: All data writes (`set`, `add`, `update`, `remove`) automatically notify subscribers
- **Filtered subscriptions**: Only receive updates matching your criteria
- **Multiple subscription types**: Collections, keys, and custom channels
- **Secure tokens**: Temporary, scoped authentication for browser-side connections
- **Connection management**: Automatic reconnection and heartbeat handling

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

// Real-time React component with streaming
function LiveUserList() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cleanup

    async function setupRealtime() {
      try {
        // Load initial data
        const initialUsers = await shov.where('users')
        setUsers(initialUsers)
        setLoading(false)

        // Subscribe to real-time updates
        const { close } = await shov.subscribe([
          { collection: 'users' }
        ], {
          onMessage: (data) => {
            if (data.type === 'message' && data.data.collection === 'users') {
              // Update users list based on the operation
              if (data.data.operation === 'add') {
                setUsers(prev => [...prev, { 
                  id: data.data.key, 
                  value: data.data.newValue 
                }])
              } else if (data.data.operation === 'remove') {
                setUsers(prev => prev.filter(u => u.id !== data.data.key))
              } else if (data.data.operation === 'update') {
                setUsers(prev => prev.map(u => 
                  u.id === data.data.key 
                    ? { ...u, value: data.data.newValue }
                    : u
                ))
              }
            }
          }
        })

        cleanup = close
      } catch (error) {
        console.error('Failed to setup real-time:', error)
        setLoading(false)
      }
    }

    setupRealtime()

    return () => {
      cleanup?.()
    }
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <h2>Live Users ({users.length})</h2>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.value.name}</li>
        ))}
      </ul>
    </div>
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
  const users = await shov.where('users')
  return users
} catch (error) {
  console.error('Failed to fetch users:', error)
  return []
}
```

### 3. Atomic Transactions
Use batch operations for atomic transactions and better performance:

```javascript
// ✅ Good - atomic transaction
const result = await shov.batch([
  { type: 'add', collection: 'orders', value: { userId: '123', total: 99.99 } },
  { type: 'update', collection: 'inventory', id: 'prod-1', value: { stock: 8 } },
  { type: 'set', name: 'user:123:last_order', value: 'order-abc123' }
])

// ✅ Good - parallel operations using Promise.all (when atomicity not needed)
const values = await Promise.all([
  shov.get('key1'),
  shov.get('key2'), 
  shov.get('key3')
])

// ❌ Bad - sequential operations without atomicity
const order = await shov.add('orders', { userId: '123', total: 99.99 })
const inventory = await shov.update('inventory', 'prod-1', { stock: 8 }) // Could fail, leaving inconsistent state
const lastOrder = await shov.set('user:123:last_order', 'order-abc123')
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
