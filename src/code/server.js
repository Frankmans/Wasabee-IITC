import WasabeeAgent from "./agent";
import WasabeeMe from "./me";
import WasabeeOp from "./operation";
import WasabeeTeam from "./team";
import { getSelectedOperation, getOperationByID } from "./selectedOp";
import wX from "./wX";

const Wasabee = window.plugin.wasabee;

export default function () {
  return GetWasabeeServer();
}

// uploads an op to the server
// local change: updates "me" and stores the result after the server has done its work
// cache: op stored to localStorage; "me" upated
export const uploadOpPromise = async function () {
  const SERVER_BASE = GetWasabeeServer();

  const operation = getSelectedOperation();
  operation.cleanAll();
  const json = JSON.stringify(operation);

  const response = await _genericPost(
    `${SERVER_BASE}/api/v1/draw`,
    json,
    "application/json;charset=UTF-8"
  );
  WasabeeMe.create(response, true); // free update to the cache
  const newop = await opPromise(operation.ID);
  newop.localchanged = false;
  newop.store();
  return newop;
};

// sends a changed op to the server
// no local change // cache: no change to localStorage
export const updateOpPromise = (operation) => {
  const SERVER_BASE = GetWasabeeServer();

  // let the server know how to process assignments etc
  operation.mode = window.plugin.wasabee.static.constants.MODE_KEY;
  operation.cleanAll();
  const json = JSON.stringify(operation);
  delete operation.mode;

  return _genericPut(
    `${SERVER_BASE}/api/v1/draw/${operation.ID}`,
    json,
    "application/json;charset=UTF-8"
  );
};

// removes an op from the server
// no local change // cache: none
export const deleteOpPromise = function (opID) {
  const SERVER_BASE = GetWasabeeServer();
  return _genericDelete(`${SERVER_BASE}/api/v1/draw/${opID}`, new FormData());
};

// returns a resolved promise to a WasabeeTeam
// local change: cache
// cache: caching both team and agents
export const teamPromise = async function (teamid, maxAgeSeconds = 0) {
  // XXX check cache first
  if (maxAgeSeconds > 0 && window.plugin.wasabee.teams.has(teamid)) {
    const t = window.plugin.wasabee.teams.get(teamid);
    if (t.fetch > Date.now() - 1000 * maxAgeSeconds) {
      console.log("returning team from cache");
      return t;
    }
    console.log("ignoring team in cache, fetching anew");
  }

  const SERVER_BASE = GetWasabeeServer();
  const response = await _genericGet(`${SERVER_BASE}/api/v1/team/${teamid}`);
  // team and agent caching takes place in WasabeeTeam.create
  const newteam = WasabeeTeam.create(response);
  return newteam;
};

// returns a promise to fetch a WasabeeOp
// local change: If the server's copy is newer than the local copy, otherwise none
// not generic since 304 result processing and If-Modified-Since header
export const opPromise = function (opID) {
  const SERVER_BASE = GetWasabeeServer();
  const localop = getOperationByID(opID);
  const url = `${SERVER_BASE}/api/v1/draw/${opID}`;

  return new Promise(function (resolve, reject) {
    const req = new XMLHttpRequest();

    req.open("GET", url);

    if (localop != null && localop.fetched) {
      req.setRequestHeader("If-Modified-Since", localop.fetched);
    }

    req.withCredentials = true;
    req.crossDomain = true;

    let newop = null; // I hate javascript
    req.onload = function () {
      switch (req.status) {
        case 200:
          newop = WasabeeOp.create(req.response);
          newop.localchanged = false;
          resolve(newop);
          break;
        case 304: // If-Modified-Since replied NotModified
          console.log("server copy is older/unmodified, keeping local copy");
          localop.localchanged = true;
          resolve(localop);
          break;
        case 401:
          WasabeeMe.purge();
          reject(wX("NOT LOGGED IN", req.statusText));
          break;
        case 403:
          reject(wX("OP PERM DENIED", opID));
          break;
        default:
          reject(`${req.status}: ${req.statusText} ${req.responseText}`);
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    req.send();
  });
};

// returns a resolved promise to WasabeeMe
// local change: updates me in localStorage
// cache: localStorage
export const mePromise = async function () {
  const SERVER_BASE = GetWasabeeServer();
  try {
    const response = await _genericGet(`${SERVER_BASE}/me`);
    const me = WasabeeMe.create(response, true);
    return me;
  } catch (e) {
    console.log(e);
    return e;
  }
};

// returns (a resolved promise of) the actual WasabeeAgent
// local change: agent saved to cache
// cache: local first unless forced
export const agentPromise = async function (GID, force = false) {
  if (!force && window.plugin.wasabee._agentCache.has(GID)) {
    return window.plugin.wasabee._agentCache.get(GID);
  }

  const SERVER_BASE = GetWasabeeServer();
  const response = await _genericGet(`${SERVER_BASE}/api/v1/agent/${GID}`);
  const wa = new WasabeeAgent(response);
  return wa;
};

// local change: none // cache: none
export const assignMarkerPromise = function (opID, markerID, agentID) {
  const SERVER_BASE = GetWasabeeServer();
  const fd = new FormData();
  fd.append("agent", agentID);
  return _genericPost(
    `${SERVER_BASE}/api/v1/draw/${opID}/marker/${markerID}/assign`,
    fd
  );
};

// local change: none // cache: none
export const assignLinkPromise = function (opID, linkID, agentID) {
  const SERVER_BASE = GetWasabeeServer();
  const fd = new FormData();
  fd.append("agent", agentID);
  return _genericPost(
    `${SERVER_BASE}/api/v1/draw/${opID}/link/${linkID}/assign`,
    fd
  );
};

// local change: none // cache: none
export const targetPromise = function (agentID, portal) {
  const SERVER_BASE = GetWasabeeServer();
  const ll = portal.lat + "," + portal.lng;
  const fd = new FormData();
  fd.append("id", agentID);
  fd.append("portal", portal.name);
  fd.append("ll", ll);
  return _genericPost(`${SERVER_BASE}/api/v1/agent/${agentID}/target`, fd);
};

// local change: none // cache: none
export const routePromise = function (agentID, portal) {
  const SERVER_BASE = GetWasabeeServer();
  const ll = portal.lat + "," + portal.lng;
  const fd = new FormData();
  fd.append("id", agentID);
  fd.append("portal", portal.name);
  fd.append("ll", ll);
  return _genericPost(`${SERVER_BASE}/api/v1/agent/${agentID}/route`, fd);
};

// local change: none // cache: none
export const SendAccessTokenAsync = function (accessToken) {
  const SERVER_BASE = GetWasabeeServer();
  return _genericPost(
    `${SERVER_BASE}/aptok`,
    JSON.stringify({ accessToken: accessToken }),
    "application/json;charset=UTF-8"
  );
};

// local change: none // cache: none
export const SetTeamState = function (teamID, state) {
  const SERVER_BASE = GetWasabeeServer();
  return _genericGet(`${SERVER_BASE}/api/v1/me/${teamID}?state=${state}`);
};

// local change: none // cache: none
export const SetMarkerState = function (opID, markerID, state) {
  let action = "incomplete";
  switch (state) {
    case "acknowledged":
      action = "acknowledge";
      break;
    case "pending":
      action = "incomplete";
      break;
    case "completed":
      action = "complete";
      break;
    default:
      action = "incomplete";
  }

  const SERVER_BASE = GetWasabeeServer();
  return _genericGet(
    `${SERVER_BASE}/api/v1/draw/${opID}/marker/${markerID}/${action}`
  );
};

// local change: none // cache: none
export const SetLinkState = function (opID, linkID, state) {
  let action = "incomplete";
  switch (state) {
    // no acknowledge for links -- use incomplete
    case "pending":
      action = "incomplete";
      break;
    case "completed":
      action = "complete";
      break;
    default:
      action = "incomplete";
  }

  const SERVER_BASE = GetWasabeeServer();
  return _genericGet(
    `${SERVER_BASE}/api/v1/draw/${opID}/link/${linkID}/${action}`
  );
};

// local change: none // cache: none
export const opKeyPromise = function (opID, portalID, onhand, capsule) {
  const SERVER_BASE = GetWasabeeServer();
  const fd = new FormData();
  fd.append("onhand", onhand ? onhand : "0");
  fd.append("capsule", capsule ? capsule : "");
  return _genericPost(
    `${SERVER_BASE}/api/v1/draw/${opID}/portal/${portalID}/keyonhand`,
    fd
  );
};

// local change: none // cache: none
export const dKeyPromise = function (portalID, onhand, capsule) {
  const SERVER_BASE = GetWasabeeServer();
  const fd = new FormData();
  fd.append("portalID", portalID ? portalID : "");
  fd.append("count", onhand ? onhand : "0");
  fd.append("capID", capsule ? capsule : "");
  return _genericPost(`${SERVER_BASE}/api/v1/d`, fd);
};

// local change: none // cache: none
export const dKeylistPromise = function () {
  const SERVER_BASE = GetWasabeeServer();
  return _genericGet(`${SERVER_BASE}/api/v1/d`);
};

// local change: none // cache: none
export const locationPromise = function (lat, lng) {
  const SERVER_BASE = GetWasabeeServer();
  return _genericGet(`${SERVER_BASE}/api/v1/me?lat=${lat}&lon=${lng}`);
};

// local change: none // cache: none
export const logoutPromise = function () {
  const SERVER_BASE = GetWasabeeServer();
  return _genericGet(`${SERVER_BASE}/api/v1/me/logout`);
};

// local change: none // cache: none
export const addPermPromise = function (opID, teamID, role) {
  const SERVER_BASE = GetWasabeeServer();
  const fd = new FormData();
  fd.append("team", teamID);
  fd.append("role", role);
  return _genericPost(`${SERVER_BASE}/api/v1/draw/${opID}/perms`, fd);
};

// local change: none // cache: none
export const delPermPromise = function (opID, teamID, role) {
  const SERVER_BASE = GetWasabeeServer();
  const fd = new FormData();
  fd.append("team", teamID);
  fd.append("role", role);
  return _genericDelete(`${SERVER_BASE}/api/v1/draw/${opID}/perms`, fd);
};

// local change: none // cache: none
export const leaveTeamPromise = function (teamID) {
  const SERVER_BASE = GetWasabeeServer();
  return _genericDelete(`${SERVER_BASE}/api/v1/me/${teamID}`, new FormData());
};

// local change: none // cache: none
export const removeAgentFromTeamPromise = function (agentID, teamID) {
  const SERVER_BASE = GetWasabeeServer();
  return _genericDelete(
    `${SERVER_BASE}/api/v1/team/${teamID}/${agentID}`,
    new FormData()
  );
};

// local change: none // cache: none
export const setAgentTeamSquadPromise = function (agentID, teamID, squad) {
  const SERVER_BASE = GetWasabeeServer();
  const fd = new FormData();
  fd.append("squad", squad);
  return _genericPost(
    `${SERVER_BASE}/api/v1/team/${teamID}/${agentID}/squad`,
    fd
  );
};

// local change: none // cache: none
export const addAgentToTeamPromise = function (agentID, teamID) {
  const SERVER_BASE = GetWasabeeServer();
  return _genericPost(
    `${SERVER_BASE}/api/v1/team/${teamID}/${agentID}`,
    new FormData()
  );
};

// local change: none // cache: none
export const renameTeamPromise = function (teamID, name) {
  const SERVER_BASE = GetWasabeeServer();
  const fd = new FormData();
  fd.append("teamname", name);
  return _genericPut(`${SERVER_BASE}/api/v1/team/${teamID}/rename`, fd);
};

// local change: none // cache: none
export const rocksPromise = function (teamID, community, apikey) {
  const SERVER_BASE = GetWasabeeServer();
  return _genericGet(
    `${SERVER_BASE}/api/v1/team/${teamID}/rockscfg?rockscomm=${community}&rockskey=${apikey}`
  );
};

// local change: none // cache: none
export const newTeamPromise = function (name) {
  const SERVER_BASE = GetWasabeeServer();
  return _genericGet(`${SERVER_BASE}/api/v1/team/new?name=${name}`);
};

// local change: none // cache: none
export const deleteTeamPromise = function (teamID) {
  const SERVER_BASE = GetWasabeeServer();
  return _genericDelete(`${SERVER_BASE}/api/v1/team/${teamID}`, new FormData());
};

// local change: none // cache: none
export const oneTimeToken = function (token) {
  const SERVER_BASE = GetWasabeeServer();
  const url = `${SERVER_BASE}/oneTimeToken`;
  const fd = new FormData();
  fd.append("token", token);
  return _genericPost(url, fd);
};

const _genericPut = function (url, formData, contentType) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();

    req.open("PUT", url);
    req.withCredentials = true;
    req.crossDomain = true;

    if (contentType != null) req.setRequestHeader("Content-Type", contentType);

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        case 401:
          WasabeeMe.purge();
          reject(wX("NOT LOGGED IN", req.statusText));
          break;
        default:
          reject(req.response);
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    req.send(formData);
  });
};

const _genericPost = function (url, formData, contentType) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();

    req.open("POST", url);
    req.withCredentials = true;
    req.crossDomain = true;

    if (contentType != null) req.setRequestHeader("Content-Type", contentType);

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        case 302: // probably unused now
          console.log("POST returnd 302: ", req);
          resolve(req.response);
          break;
        case 401:
          WasabeeMe.purge();
          reject(wX("NOT LOGGED IN", req.statusText));
          break;
        default:
          reject(req.response);
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    req.send(formData);
  });
};

const _genericDelete = function (url, formData) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();

    req.open("DELETE", url);
    req.withCredentials = true;
    req.crossDomain = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        case 401:
          WasabeeMe.purge();
          reject(wX("NOT LOGGED IN", req.statusText));
          break;
        default:
          reject(req.response);
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };
    req.send(formData);
  });
};

const _genericGet = function (url) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();

    req.open("GET", url);
    req.withCredentials = true;
    req.crossDomain = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        case 401:
          WasabeeMe.purge();
          reject(wX("NOT LOGGED IN", req.statusText));
          break;
        case 403:
          reject(req.response);
          break;
        default:
          reject(req.response);
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };
    req.send();
  });
};

export const GetWasabeeServer = () => {
  let server = localStorage[Wasabee.static.constants.SERVER_BASE_KEY];
  if (server == null) {
    server = Wasabee.static.constants.SERVER_BASE_DEFAULT;
    localStorage[Wasabee.static.constants.SERVER_BASE_KEY] = server;
  }
  return server;
};

export const SetWasabeeServer = (server) => {
  // XXX sanity checking here please:
  // starts w/ https://
  // does not end with /
  localStorage[Wasabee.static.constants.SERVER_BASE_KEY] = server;
};
