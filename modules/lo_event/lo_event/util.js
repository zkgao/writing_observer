import crypto from 'crypto'
/*
  Browser information object, primarily for debugging. Note that not
  all fields will be available in all browsers and contexts. If not
  available, it will return blanks (this is even usable in node.js,
  but it will simply return that there is no navigator, window, or
  document object).

  @returns {Object} An object containing the browser information.
 */
export function getBrowserInfo() {
  const fields = [
    'appCodeName',
    'appName',
    'buildID',
    'cookieEnabled',
    'deviceMemory',
    'language',
    'languages',
    'onLine',
    'oscpu',
    'platform',
    'product',
    'productSub',
    'userAgent',
    'webdriver'
  ];

  const connectionFields = [
    'effectiveType',
    'rtt',
    'downlink',
    'type',
    'downlinkMax'
  ];

  const documentFields = [
    'URL',
    'baseURI',
    'characterSet',
    'charset',
    'compatMode',
    'cookie',
    'currentScript',
    'designMode',
    'dir',
    'doctype',
    'documentURI',
    'domain',
    'fullscreen',
    'fullscreenEnabled',
    'hidden',
    'inputEncoding',
    'isConnected',
    'lastModified',
    'location',
    'mozSyntheticDocument',
    'pictureInPictureEnabled',
    'plugins',
    'readyState',
    'referrer',
    'title',
    'visibilityState'
  ];

  const windowFields = [
    'closed',
    'defaultStatus',
    'innerHeight',
    'innerWidth',
    'name',
    'outerHeight',
    'outerWidth',
    'pageXOffset',
    'pageYOffset',
    'screenX',
    'screenY',
    'status'
  ];

  const browserInfo = {};

  if(typeof navigator === 'undefined') {
    browserInfo['navigator'] = 'undefined';
  } else {
    for (let i = 0; i < fields.length; i++) {
      browserInfo[fields[i]] = navigator[fields[i]];
    }

    browserInfo.connection = {};
    if (navigator.connection) {
      for (let i = 0; i < connectionFields.length; i++) {
        browserInfo.connection[connectionFields[i]] = navigator.connection[connectionFields[i]];
      }
    }
  }

  if(typeof document === 'undefined') {
    browserInfo['document'] = 'undefined';
  } else {
    browserInfo.document = {};
    for (let i = 0; i < documentFields.length; i++) {
      browserInfo.document[documentFields[i]] = document[documentFields[i]];
    }
  }

  if(typeof window === 'undefined') {
    browserInfo['window'] = 'undefined';
  } else {
    browserInfo.window = {};
    for (let i = 0; i < windowFields.length; i++) {
      browserInfo.window[windowFields[i]] = window[windowFields[i]];
    }
  }

  return browserInfo;
}

/*
  This function is a wrapper for retrieving profile information using
  the Chrome browser's identity API. It addresses a bug in the Chrome
  function and converts it into a modern async function. The bug it
  works around can be found at
  https://bugs.chromium.org/p/chromium/issues/detail?id=907425#c6.

  To do: Add chrome.identity.getAuthToken() to retrieve an
  authentication token, so we can do real authentication.

  Returns:
    A Promise that resolves with the user's profile information.

  Example usage:
    const profileInfo = await profileInfoWrapper();
    console.log(profileInfo);
  */
export async function profileInfoWrapper () {
  if (typeof chrome !== 'undefined' && chrome.identity) {
    try {
      return await new Promise((resolve, reject) => {
        chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, function (data) {
          resolve(data)
        })
      })
    } catch (e) {
      return await new Promise((resolve, reject) => {
        chrome.identity.getProfileUserInfo(function (data) {
          resolve(data)
        })
      })
    }
  }
  // Default to an empty object
  return new Promise((resolve, reject) => {
    resolve({})
  })
}

/*
  Generate a unique key, which can be used for session IDs, anonymous user IDs, and other similar purposes.

  Parameters:
  - prefix (str): Optional prefix to prepend to the generated key.

  Returns:
  str: A string representing the unique key, in the format "{prefix}-{randomUUID}-{timestamp}". If no prefix is provided, the format will be "{randomUUID}-{timestamp}".
  */
export function keystamp(prefix) {
  return `${prefix ? prefix + '-' : ''}${crypto.randomUUID()}-${Date.now()}`;
}


/*
  Create a fully-qualified web socket URL. 

  All parameters are optional when running on a web page. On an extension,
  we need, at least, the base server.

  This will:
  * Convert relative URLs into fully-qualified ones, if necessary
  * Convert HTTP/HTTPS URLs into WS/WSS ones, if necessary
  */
export function fullyQualifiedWebsocketURL(default_relative_url, default_base_server) {
  const relative_url = default_relative_url || "/wsapi/in";
  const base_server = default_base_server || (typeof document !== 'undefined' && document.location);

  if (!base_server) {
    throw new Error("Base server is not provided.");
  }

  const url = new URL(relative_url, base_server);

  const protocol_map = {"https:": "wss:", "http:": "ws:", "ws:": "ws:", "wss:": "wss"};

  if (!protocol_map[url.protocol]) {
    throw new Error("Protocol mapping not found.");
  }

  url.protocol = protocol_map[url.protocol];

  return url.href;
}

/*
  We include some metadata. Much of this is primarily for
  debugging. For example, it's helpful to have multiple timestamps
  in order to understand timezone issues, misset clocks, etc.
 */
export function defaultEventMetadata({ source, version }) {
  const metadata = { source, version };

  // Check if logger_id exists in localStorage and set if it doesn't
  if (localStorage.getItem("logger_id") === null) {
    localStorage.setItem("logger_id", keystamp('lid'));
  }

  // Check if logger_id exists in sessionStorage and set if it doesn't
  if (sessionStorage.getItem("logger_id") === null) {
    sessionStorage.setItem("logger_id", keystamp('sid'));
  }

  metadata['browser_id'] = localStorage.getItem("logger_id");
  metadata['session_id'] = sessionStorage.getItem("logger_id");
  metadata['logger_id'] = keystamp()

  metadata['ts'] = Date.now();
  metadata['human_ts'] = Date();
  metadata['iso_ts'] = new Date().toISOString;

  // Optional auth for demos
  if(localStorage.getItem("name") !== null) {
	  metadata['name'] = localStorage.getItem("name");
  }

  metadata['browser_info'] = getBrowserInfo();           // <-- Check these lines
  // metadata['profile_info'] = profileInfoWrapper(); // <-- Check these lines

  return metadata;
}

/**
 * Merges the output of dictionaries, sync functions, and async
 * functions into a single master dictionary.
 *
 * Functions and async functions should return dictionaries.
 *
 * @param {Array} inputList - List of dictionaries, sync functions, and async functions
 * @returns {Promise<Object>} - A Promise that resolves to the compiled master dictionary
 */
export async function mergeMetadata(inputList) {
  // Initialize the master dictionary
  const masterDict = {};

  // Iterate over each item in the input list
  for (const item of inputList) {
    let result;

    if (typeof item === 'object') {
      // If the item is a dictionary, merge it into the master dictionary
      Object.assign(masterDict, item);
    } else if (typeof item === 'function') {
      // If the item is a function (sync or async), execute it
      result = await item();

      if (typeof result === 'object') {
        // If the result of the function is a dictionary, merge it into the master dictionary
        Object.assign(masterDict, result);
      } else {
        console.log('Ignoring non-dictionary result:', result);
      }
    } else {
      console.log('Ignoring invalid item:', item);
    }
  }

  return masterDict;
}

export function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}