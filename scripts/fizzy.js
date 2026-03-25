#!/usr/bin/env node
/**
 * Fizzy CLI Helper
 * Usage: node fizzy.js <command> [options]
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Config
const BASE_URL = process.env.FIZZY_BASE_URL || '';
const TOKEN = process.env.FIZZY_TOKEN;
let ACCOUNT = process.env.FIZZY_ACCOUNT || '';

// Check config
function checkConfig() {
  const missing = [];
  if (!TOKEN) missing.push('FIZZY_TOKEN');
  if (!BASE_URL) missing.push('FIZZY_BASE_URL');

  if (missing.length > 0) {
    console.error(`Error: Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('Set these in your shell or inject them via your OpenClaw config.');
    process.exit(1);
  }
}

async function getAccount() {
  if (ACCOUNT) return ACCOUNT;

  const identity = await apiRequest('GET', '/my/identity');
  const slug = identity?.accounts?.[0]?.slug;

  if (!slug) {
    throw new Error('Unable to determine account slug. Set FIZZY_ACCOUNT explicitly or verify /my/identity works.');
  }

  ACCOUNT = slug;
  return ACCOUNT;
}

// Parse URL to determine http/https module
function getClient(url) {
  return url.startsWith('https:') ? https : http;
}

// Make authenticated API request
function apiRequest(method, endpoint, data = null, isMultipart = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const client = getClient(url.toString());
    
    const options = {
      method: method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
      }
    };

    if (!isMultipart) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 400) {
            const msg = json.error || json.message || `HTTP ${res.statusCode}`;
            reject(new Error(`API error ${res.statusCode}: ${msg}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject(new Error(`API error ${res.statusCode}: ${body || 'No response body'}`));
          } else {
            resolve(body);
          }
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      if (Buffer.isBuffer(data)) {
        req.write(data);
      } else if (typeof data === 'string') {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    
    req.end();
  });
}

// Upload file directly to storage URL
function uploadToStorage(url, headers, fileBuffer) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = getClient(url);
    
    const options = {
      method: 'PUT',
      headers: headers
    };

    const req = client.request(parsedUrl, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          reject(new Error(`Upload failed: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

// Create multipart form data
function createMultipartFormData(fields, fileField, filePath) {
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  
  let body = Buffer.alloc(0);
  
  // Add regular fields
  for (const [key, value] of Object.entries(fields)) {
    body = Buffer.concat([
      body,
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`),
      Buffer.from(`${value}\r\n`)
    ]);
  }
  
  // Add file
  const contentType = getContentType(filename);
  body = Buffer.concat([
    body,
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\n`),
    Buffer.from(`Content-Type: ${contentType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  
  return { body, boundary };
}

// Get content type based on file extension
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.json': 'application/json'
  };
  return types[ext] || 'application/octet-stream';
}

// Calculate MD5 checksum
function calculateChecksum(buffer) {
  return crypto.createHash('md5').update(buffer).digest('base64');
}

// Parse arguments
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      result[key] = value;
      if (value !== true) i++;
    }
  }
  return result;
}

// Commands
const commands = {
  async identity() {
    checkConfig();
    const result = await apiRequest('GET', '/my/identity');
    console.log(JSON.stringify(result, null, 2));
  },

  async 'cards:list'() {
    checkConfig();
    const result = await apiRequest('GET', `${await getAccount()}/cards`);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'card:get'(args) {
    checkConfig();
    const cardNumber = args[0];
    if (!cardNumber) {
      console.error('Usage: card:get <card_number>');
      process.exit(1);
    }
    const result = await apiRequest('GET', `${await getAccount()}/cards/${cardNumber}`);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'card:update'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number']) {
      console.error('Usage: card:update --card-number NUM [--title TITLE] [--description HTML]');
      process.exit(1);
    }
    const data = { card: {} };
    if (opts.title) data.card.title = opts.title;
    if (opts.description) data.card.description = opts.description;
    
    if (Object.keys(data.card).length === 0) {
      console.error('Error: Provide at least --title or --description');
      process.exit(1);
    }
    
    const result = await apiRequest('PUT', `${await getAccount()}/cards/${opts['card-number']}`, data);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'card:delete'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number']) {
      console.error('Usage: card:delete --card-number NUM');
      process.exit(1);
    }
    await apiRequest('DELETE', `${await getAccount()}/cards/${opts['card-number']}`);
    console.log('Card deleted successfully');
  },

  async 'card:close'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number']) {
      console.error('Usage: card:close --card-number NUM');
      process.exit(1);
    }
    await apiRequest('POST', `${await getAccount()}/cards/${opts['card-number']}/closure`);
    console.log('Card closed successfully');
  },

  async 'card:reopen'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number']) {
      console.error('Usage: card:reopen --card-number NUM');
      process.exit(1);
    }
    await apiRequest('DELETE', `${await getAccount()}/cards/${opts['card-number']}/closure`);
    console.log('Card reopened successfully');
  },

  async 'card:assign'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number'] || !opts['user-id']) {
      console.error('Usage: card:assign --card-number NUM --user-id USER_ID');
      process.exit(1);
    }
    await apiRequest('POST', `${await getAccount()}/cards/${opts['card-number']}/assignments`, { assignee_id: opts['user-id'] });
    console.log('Assignment toggled successfully');
  },

  async 'card:tag'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number'] || !opts.tag) {
      console.error('Usage: card:tag --card-number NUM --tag "tag name"');
      process.exit(1);
    }
    await apiRequest('POST', `${await getAccount()}/cards/${opts['card-number']}/taggings`, { tag_title: opts.tag });
    console.log('Tag toggled successfully');
  },

  async 'card:move'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number'] || !opts['column-id']) {
      console.error('Usage: card:move --card-number NUM --column-id COLUMN_ID');
      process.exit(1);
    }
    await apiRequest('POST', `${await getAccount()}/cards/${opts['card-number']}/triage`, { column_id: opts['column-id'] });
    console.log('Card moved successfully');
  },

  async 'columns:list'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['board-id']) {
      console.error('Usage: columns:list --board-id BOARD_ID');
      process.exit(1);
    }
    const result = await apiRequest('GET', `${await getAccount()}/boards/${opts['board-id']}/columns`);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'card:create'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['board-id'] || !opts.title) {
      console.error('Usage: card:create --board-id ID --title TITLE [--description HTML]');
      process.exit(1);
    }
    const data = {
      card: {
        title: opts.title,
        description: opts.description || ''
      }
    };
    const result = await apiRequest('POST', `${await getAccount()}/boards/${opts['board-id']}/cards`, data);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'comments:list'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number']) {
      console.error('Usage: comments:list --card-number NUM');
      process.exit(1);
    }
    const result = await apiRequest('GET', `${await getAccount()}/cards/${opts['card-number']}/comments`);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'comment:add'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number'] || !opts.body) {
      console.error('Usage: comment:add --card-number NUM --body TEXT');
      process.exit(1);
    }
    const data = { comment: { body: opts.body } };
    const result = await apiRequest('POST', `${await getAccount()}/cards/${opts['card-number']}/comments`, data);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'boards:list'() {
    checkConfig();
    const result = await apiRequest('GET', `${await getAccount()}/boards`);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'board:create'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts.name) {
      console.error('Usage: board:create --name "Board Name"');
      process.exit(1);
    }
    const data = { board: { name: opts.name } };
    const result = await apiRequest('POST', `${await getAccount()}/boards`, data);
    console.log('Board created successfully');
    if (result && Object.keys(result).length > 0) {
      console.log(JSON.stringify(result, null, 2));
    }
  },

  async 'board:update'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['board-id'] || !opts.name) {
      console.error('Usage: board:update --board-id ID --name "New Name"');
      process.exit(1);
    }
    const data = { board: { name: opts.name } };
    await apiRequest('PUT', `${await getAccount()}/boards/${opts['board-id']}`, data);
    console.log('Board updated successfully');
  },

  async 'board:delete'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['board-id']) {
      console.error('Usage: board:delete --board-id ID');
      process.exit(1);
    }
    await apiRequest('DELETE', `${await getAccount()}/boards/${opts['board-id']}`);
    console.log('Board deleted successfully');
  },

  async 'tags:list'() {
    checkConfig();
    const result = await apiRequest('GET', `${await getAccount()}/tags`);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'card:image'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number'] || !opts.file) {
      console.error('Usage: card:image --card-number NUM --file /path/to/image.jpg');
      process.exit(1);
    }
    
    if (!fs.existsSync(opts.file)) {
      console.error(`Error: File not found: ${opts.file}`);
      process.exit(1);
    }
    
    const { body, boundary } = createMultipartFormData({}, 'card[image]', opts.file);
    
    const url = new URL(`${await getAccount()}/cards/${opts['card-number']}`, BASE_URL);
    const client = getClient(url.toString());
    
    const options = {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = client.request(url, options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(responseBody);
            if (res.statusCode >= 400) {
              const msg = json.error || json.message || `HTTP ${res.statusCode}`;
              reject(new Error(`API error ${res.statusCode}: ${msg}`));
            } else {
              console.log(JSON.stringify(json, null, 2));
              resolve(json);
            }
          } catch (e) {
            if (res.statusCode >= 400) {
              reject(new Error(`API error ${res.statusCode}: ${responseBody || 'No response body'}`));
            } else {
              console.log(responseBody);
              resolve(responseBody);
            }
          }
        });
      });

      req.on('error', reject);
      
      req.write(body);
      req.end();
    });
  },

  async 'card:remove-image'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['card-number']) {
      console.error('Usage: card:remove-image --card-number NUM');
      process.exit(1);
    }
    
    await apiRequest('DELETE', `${await getAccount()}/cards/${opts['card-number']}/image`);
    console.log('Image removed successfully');
  },

  async 'upload'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts.file) {
      console.error('Usage: upload --file /path/to/file.png');
      process.exit(1);
    }
    
    if (!fs.existsSync(opts.file)) {
      console.error(`Error: File not found: ${opts.file}`);
      process.exit(1);
    }
    
    const fileBuffer = fs.readFileSync(opts.file);
    const filename = path.basename(opts.file);
    const contentType = getContentType(filename);
    const checksum = calculateChecksum(fileBuffer);
    
    // Step 1: Request direct upload URL
    const uploadData = {
      blob: {
        filename: filename,
        byte_size: fileBuffer.length,
        checksum: checksum,
        content_type: contentType
      }
    };
    
    console.log('Requesting direct upload URL...');
    const directUpload = await apiRequest('POST', `${await getAccount()}/rails/active_storage/direct_uploads`, uploadData);
    
    if (!directUpload.direct_upload || !directUpload.direct_upload.url) {
      console.error('Error: Failed to get direct upload URL');
      console.error(JSON.stringify(directUpload, null, 2));
      process.exit(1);
    }
    
    // Step 2: Upload file to storage
    console.log('Uploading file to storage...');
    await uploadToStorage(
      directUpload.direct_upload.url,
      directUpload.direct_upload.headers,
      fileBuffer
    );
    
    // Step 3: Return signed_id for use in attachments
    console.log('\nUpload successful!');
    console.log('Signed ID:', directUpload.signed_id);
    console.log('\nUse this in description HTML:');
    console.log(`<action-text-attachment sgid="${directUpload.signed_id}"></action-text-attachment>`);
  },

  async 'user:update'(args) {
    checkConfig();
    const opts = parseArgs(args);
    if (!opts['user-id']) {
      console.error('Usage: user:update --user-id ID [--name "New Name"] [--file /path/to/avatar.jpg]');
      process.exit(1);
    }
    
    const fields = {};
    if (opts.name) fields['user[name]'] = opts.name;
    
    // If avatar file provided, use multipart upload
    if (opts.file) {
      if (!fs.existsSync(opts.file)) {
        console.error(`Error: File not found: ${opts.file}`);
        process.exit(1);
      }
      
      const { body, boundary } = createMultipartFormData(fields, 'user[avatar]', opts.file);
      
      const url = new URL(`${await getAccount()}/users/${opts['user-id']}`, BASE_URL);
      const client = getClient(url.toString());
      
      const options = {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      };

      return new Promise((resolve, reject) => {
        const req = client.request(url, options, (res) => {
          let responseBody = '';
          res.on('data', chunk => responseBody += chunk);
          res.on('end', () => {
            if (res.statusCode === 204) {
              console.log('User updated successfully');
              resolve({ success: true });
            } else if (res.statusCode >= 400) {
              try {
                const json = JSON.parse(responseBody);
                const msg = json.error || json.message || `HTTP ${res.statusCode}`;
                reject(new Error(`API error ${res.statusCode}: ${msg}`));
              } catch (e) {
                reject(new Error(`API error ${res.statusCode}: ${responseBody || 'No response body'}`));
              }
            } else {
              try {
                const json = JSON.parse(responseBody);
                console.log(JSON.stringify(json, null, 2));
                resolve(json);
              } catch (e) {
                console.log(responseBody);
                resolve(responseBody);
              }
            }
          });
        });

        req.on('error', reject);
        
        req.write(body);
        req.end();
      });
    } else {
      // JSON update (name only)
      const data = { user: {} };
      if (opts.name) data.user.name = opts.name;
      
      const result = await apiRequest('PUT', `${await getAccount()}/users/${opts['user-id']}`, data);
      console.log('User updated successfully');
      if (result && Object.keys(result).length > 0) {
        console.log(JSON.stringify(result, null, 2));
      }
    }
  },

  async 'users:list'() {
    checkConfig();
    const result = await apiRequest('GET', `${await getAccount()}/users`);
    console.log(JSON.stringify(result, null, 2));
  }
};

// Main
async function main() {
  const [,, cmd, ...args] = process.argv;

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log('Fizzy CLI Helper (Node.js)');
    console.log('');
    console.log('Commands:');
    console.log('  identity              Get account identity');
    console.log('  boards:list           List all boards');
    console.log('  board:create          Create a new board (see --name)');
    console.log('  board:update          Update board name (see --board-id, --name)');
    console.log('  board:delete          Delete a board (see --board-id)');
    console.log('  columns:list          List columns on a board (see --board-id)');
    console.log('  cards:list            List cards');
    console.log('  card:get <num>        Get specific card');
    console.log('  card:create           Create card (see --board-id, --title, --description)');
    console.log('  card:update           Update card (see --card-number, --title, --description)');
    console.log('  card:delete           Delete card (see --card-number)');
    console.log('  card:close            Close card (see --card-number)');
    console.log('  card:reopen           Reopen card (see --card-number)');
    console.log('  card:assign           Toggle assignment (see --card-number, --user-id)');
    console.log('  card:tag              Toggle tag (see --card-number, --tag)');
    console.log('  card:move             Move to column (see --card-number, --column-id)');
    console.log('  card:image            Upload header image (see --card-number, --file)');
    console.log('  card:remove-image     Remove card header image (see --card-number)');
    console.log('  comments:list         List comments on a card (see --card-number)');
    console.log('  comment:add           Add comment (see --card-number, --body)');
    console.log('  tags:list             List all tags');
    console.log('  upload                Direct upload for attachments (see --file)');
    console.log('  users:list            List all users');
    console.log('  user:update           Update user (see --user-id, --name, --file)');
    console.log('');
    console.log('Tips:');
    console.log('  For --description with HTML, use single quotes to avoid escaping issues:');
    console.log(`    $FZ card:create --board-id ID --title "Title" --description '<p>Content</p>'`);
    console.log('');
    console.log('Environment variables:');
    console.log('  FIZZY_BASE_URL        Base URL of your Fizzy instance (required)');
    console.log('  FIZZY_TOKEN           Personal access token (required)');
    console.log('  FIZZY_ACCOUNT         Account slug (optional; auto-discovers from /my/identity if unset)');
    return;
  }

  const handler = commands[cmd];
  if (!handler) {
    console.error(`Unknown command: ${cmd}`);
    console.error('Run with no arguments for help.');
    process.exit(1);
  }

  try {
    await handler(args);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
