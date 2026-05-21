import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App and Auth
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const basicProvider = new GoogleAuthProvider();
// No restricted scopes for basic login to avoid any Google blocks

const fullProvider = new GoogleAuthProvider();
fullProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
fullProvider.addScope('https://www.googleapis.com/auth/gmail.send');
fullProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
fullProvider.addScope('https://www.googleapis.com/auth/spreadsheets');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Store cache in memory, clear on signOut
export const initWorkspaceAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const manualToken = localStorage.getItem('manual_google_access_token');
  if (manualToken) {
    cachedAccessToken = manualToken;
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    const activeToken = cachedAccessToken || localStorage.getItem('manual_google_access_token');
    
    if (user && activeToken) {
      if (onAuthSuccess) onAuthSuccess(user, activeToken);
    } else if (activeToken) {
      // Mocked manual user representation
      const dummyUser = {
        displayName: 'Administrateur Cloud',
        email: 'technologiav01@gmail.com',
        photoURL: null
      } as any;
      if (onAuthSuccess) onAuthSuccess(dummyUser, activeToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const setManualAccessToken = (token: string) => {
  cachedAccessToken = token;
  localStorage.setItem('manual_google_access_token', token);
  localStorage.setItem('workspace_has_active_session', 'true');
};

export const workspaceSignIn = async (useFullScopes = true): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = useFullScopes ? fullProvider : basicProvider;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google OAuth');
    }

    cachedAccessToken = credential.accessToken;
    // Clear manual token since we successfully signed in via OAuth
    localStorage.removeItem('manual_google_access_token');
    localStorage.setItem('workspace_has_active_session', 'true');
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Workspace login error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getWorkspaceAccessToken = (): string | null => {
  return cachedAccessToken || localStorage.getItem('manual_google_access_token');
};

export const workspaceLogout = async () => {
  try {
    await auth.signOut();
  } catch (e) {
    console.warn("Firebase signout failed, continuing local clean:", e);
  }
  cachedAccessToken = null;
  localStorage.removeItem('manual_google_access_token');
  localStorage.removeItem('workspace_has_active_session');
};

/**
 * --- GMAIL INTEGRATION HELPER FUNCTIONS ---
 */

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
}

// Convert gmail headers list to friendly object fields
function parseHeaders(headers: { name: string; value: string }[]) {
  const result: Record<string, string> = {};
  for (const h of headers) {
    result[h.name.toLowerCase()] = h.value;
  }
  return result;
}

// Fetch 15 recent messages
export async function getRecentEmails(token: string): Promise<GmailMessage[]> {
  try {
    const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=in:inbox';
    const response = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }

    const listData = await response.json();
    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    const emailDetails = await Promise.all(
      listData.messages.map(async (msg: { id: string }) => {
        try {
          const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
          const detailRes = await fetch(detailUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!detailRes.ok) return null;
          const detail = await detailRes.json();
          const pHeaders = parseHeaders(detail.payload.headers || []);

          // Try and find body content within parts
          let body = '';
          if (detail.payload.body && detail.payload.body.data) {
            body = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          } else if (detail.payload.parts) {
            // Traverse parts to find text/plain
            const getPartBody = (parts: any[]): string => {
              for (const p of parts) {
                if (p.mimeType === 'text/plain' && p.body && p.body.data) {
                  return atob(p.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                }
                if (p.parts) {
                  const b = getPartBody(p.parts);
                  if (b) return b;
                }
              }
              return '';
            };
            body = getPartBody(detail.payload.parts);
          }

          if (!body) {
            body = detail.snippet || '';
          }

          // Clean body a bit for view
          body = body.slice(0, 5000); 

          return {
            id: detail.id,
            threadId: detail.threadId,
            snippet: detail.snippet || '',
            subject: pHeaders['subject'] || '(Sans objet)',
            from: pHeaders['from'] || 'Inconnu',
            to: pHeaders['to'] || 'Moi',
            date: pHeaders['date'] || '',
            body: body
          } as GmailMessage;
        } catch (e) {
          console.warn(`Failed fetching email ${msg.id}`, e);
          return null;
        }
      })
    );

    return emailDetails.filter(Boolean) as GmailMessage[];
  } catch (err) {
    console.error('Error fetching recent emails:', err);
    throw err;
  }
}

// Send Email reply or new email
export async function sendEmail(
  token: string,
  to: string,
  subject: string,
  bodyHtml: string,
  threadId?: string
): Promise<any> {
  try {
    const utf8Subject = `=?utf-8?B?${btoa(encodeURIComponent(subject).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))}?=`;
    const messageParts = [
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
    ];

    if (threadId) {
      messageParts.push(`In-Reply-To: <${threadId}>`);
      messageParts.push(`References: <${threadId}>`);
    }

    messageParts.push(''); // Empty line between headers and content
    messageParts.push(bodyHtml);
    
    const message = messageParts.join('\n');
    const encodedMessage = btoa(encodeURIComponent(message).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: encodedMessage,
        threadId: threadId
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to send email: ${response.status} - ${errText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * --- GOOGLE DRIVE FILE BROWSER HELPER ---
 */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

export async function getRecentDriveFiles(token: string): Promise<DriveFile[]> {
  try {
    // Filter for google sheets, docs, text files, and spreadsheets modified recently
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.document' or mimeType='text/csv' or name contains '.csv' or name contains '.xlsx'");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime%20desc&pageSize=25&fields=files(id,name,mimeType,modifiedTime,size)`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Drive API error: ${response.status}`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (err) {
    console.error('Error listing Drive files:', err);
    throw err;
  }
}

/**
 * Fetch files dynamic content from Google Drive
 */
export async function getDriveFileContent(token: string, fileId: string, mimeType: string): Promise<string> {
  try {
    let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    
    // For Google Workspace files, we must call the export endpoint
    if (mimeType === 'application/vnd.google-apps.document') {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
    }
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Drive Content API status: ${response.status}`);
    }
    
    return await response.text();
  } catch (err) {
    console.error('Error in getDriveFileContent:', err);
    throw err;
  }
}

/**
 * Save updated content to Google Drive
 */
export async function updateDriveFileContent(token: string, fileId: string, mimeType: string, content: string): Promise<any> {
  try {
    let url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    
    // If we're updating a spreadsheet, upload with corresponding format
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType.includes('spreadsheet') ? 'text/csv' : 'text/plain'
      },
      body: content
    });
    
    if (!response.ok) {
      throw new Error(`Drive Write API status: ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('Error in updateDriveFileContent:', err);
    throw err;
  }
}

/**
 * --- GOOGLE SHEETS WRITEBACK INTEGRATION ---
 */
export async function appendRowToGoogleSheet(
  token: string,
  spreadsheetId: string,
  range: string, // e.g. "Sheet1!A1"
  values: any[][]
): Promise<any> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: values
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to update sheet: ${response.status} - ${errText}`);
    }

    return await response.json();
  } catch (err) {
    console.error('Error appending row to sheet:', err);
    throw err;
  }
}
