export const REMINDERS_JXA_SCRIPT = String.raw`
ObjC.import('Foundation');

function getEnv(name) {
  try {
    var env = $.NSProcessInfo.processInfo.environment;
    var raw = env.objectForKey(name);
    return raw ? ObjC.unwrap(raw) : '';
  } catch (error) {
    return '';
  }
}

function safeCall(fn, fallbackValue) {
  try {
    var value = fn();
    return value === undefined || value === null ? fallbackValue : value;
  } catch (error) {
    return fallbackValue;
  }
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function toBoolean(value, fallbackValue) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    var normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes') return true;
    if (normalizedValue === 'false' || normalizedValue === '0' || normalizedValue === 'no') return false;
  }
  return fallbackValue;
}

function toInteger(value, fallbackValue, minValue, maxValue) {
  var numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallbackValue;

  var parsed = Math.trunc(numeric);
  if (parsed < minValue) return minValue;
  if (parsed > maxValue) return maxValue;
  return parsed;
}

function toIsoDate(value) {
  if (!value) return null;

  try {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch (error) {
    return null;
  }
}

function parseDateInput(value, fieldName, fallbackValue) {
  if (value === undefined || value === '') {
    return fallbackValue;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Invalid date for "' + fieldName + '".');
    }
    return value;
  }

  if (typeof value === 'string') {
    var trimmed = value.trim();
    if (!trimmed) return fallbackValue;

    var parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Invalid ISO date for "' + fieldName + '": ' + value);
    }

    return parsed;
  }

  throw new Error('Invalid date for "' + fieldName + '".');
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Missing or invalid "' + fieldName + '".');
  }

  return value.trim();
}

function cleanNullableText(value) {
  if (value === undefined) return undefined;
  if (value === null) return '';
  return String(value);
}

function remindersAccessError(label, error) {
  var message = error && error.message ? String(error.message) : String(error);
  return new Error(
    'Failed to read Reminders ' +
      label +
      '. macOS may require Reminders permission and Automation access for this process. Original error: ' +
      message
  );
}

function readArrayOrThrow(fn, label) {
  try {
    return ensureArray(fn());
  } catch (error) {
    throw remindersAccessError(label, error);
  }
}

function isDateBefore(isoValue, boundaryDate) {
  if (!isoValue || !(boundaryDate instanceof Date) || Number.isNaN(boundaryDate.getTime())) {
    return false;
  }

  var parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed < boundaryDate;
}

function ensureAppReady(app) {
  safeCall(function () {
    if (!app.running()) {
      app.launch();
      delay(0.75);
    }

    app.name();
    return true;
  }, false);
}

function buildState(app, options) {
  var includeReminders = !options || options.includeReminders !== false;
  var state = {
    accounts: [],
    lists: [],
    reminders: [],
    accountsById: {},
    listsById: {},
    remindersById: {},
    defaultAccountId: null,
    defaultListId: null,
  };

  var seenListIds = {};
  var seenReminderIds = {};

  state.defaultAccountId = safeCall(function () {
    var account = app.defaultAccount();
    return account && account.id ? account.id() : null;
  }, null);

  state.defaultListId = safeCall(function () {
    var list = app.defaultList();
    return list && list.id ? list.id() : null;
  }, null);

  function pushReminder(reminderObj, accountEntry, listEntry) {
    var reminderId = safeCall(function () { return reminderObj.id(); }, '');
    if (!reminderId || seenReminderIds[reminderId]) return;

    seenReminderIds[reminderId] = true;

    var reminderEntry = {
      obj: reminderObj,
      id: reminderId,
      title: safeCall(function () { return reminderObj.name(); }, ''),
      body: cleanNullableText(safeCall(function () { return reminderObj.body(); }, '')),
      completed: toBoolean(safeCall(function () { return reminderObj.completed(); }, false), false),
      completionDate: toIsoDate(safeCall(function () { return reminderObj.completionDate(); }, null)),
      dueDate: toIsoDate(safeCall(function () { return reminderObj.dueDate(); }, null)),
      allDayDueDate: toIsoDate(safeCall(function () { return reminderObj.alldayDueDate(); }, null)),
      remindMeDate: toIsoDate(safeCall(function () { return reminderObj.remindMeDate(); }, null)),
      priority: toInteger(safeCall(function () { return reminderObj.priority(); }, 0), 0, 0, 9),
      flagged: toBoolean(safeCall(function () { return reminderObj.flagged(); }, false), false),
      creationDate: toIsoDate(safeCall(function () { return reminderObj.creationDate(); }, null)),
      modificationDate: toIsoDate(safeCall(function () { return reminderObj.modificationDate(); }, null)),
      listId: listEntry.id,
      listName: listEntry.name,
      accountId: accountEntry.id,
      accountName: accountEntry.name,
    };

    state.reminders.push(reminderEntry);
    state.remindersById[reminderEntry.id] = reminderEntry;
  }

  function pushList(listObj, accountEntry) {
    var listId = safeCall(function () { return listObj.id(); }, '');
    if (!listId || seenListIds[listId]) return;

    seenListIds[listId] = true;

    var listEntry = {
      obj: listObj,
      id: listId,
      name: safeCall(function () { return listObj.name(); }, '(Untitled List)'),
      color: cleanNullableText(safeCall(function () { return listObj.color(); }, null)),
      emblem: cleanNullableText(safeCall(function () { return listObj.emblem(); }, null)),
      accountId: accountEntry.id,
      accountName: accountEntry.name,
    };

    state.lists.push(listEntry);
    state.listsById[listEntry.id] = listEntry;

    if (includeReminders) {
      var reminders = readArrayOrThrow(function () { return listObj.reminders(); }, 'reminders');
      for (var index = 0; index < reminders.length; index += 1) {
        pushReminder(reminders[index], accountEntry, listEntry);
      }
    }
  }

  var accounts = [];
  var topLevelLists = [];
  var accountsError = null;
  var listsError = null;

  try {
    accounts = ensureArray(app.accounts());
  } catch (error) {
    accountsError = error;
  }

  try {
    topLevelLists = ensureArray(app.lists());
  } catch (error) {
    listsError = error;
  }

  if (accountsError && listsError) {
    throw remindersAccessError('accounts and lists', accountsError);
  }

  for (var accountIndex = 0; accountIndex < accounts.length; accountIndex += 1) {
    var accountObj = accounts[accountIndex];
    var accountEntry = {
      obj: accountObj,
      id: safeCall(function () { return accountObj.id(); }, ''),
      name: safeCall(function () { return accountObj.name(); }, '(Unnamed Account)'),
    };

    state.accounts.push(accountEntry);
    state.accountsById[accountEntry.id] = accountEntry;

    var lists = readArrayOrThrow(function () { return accountObj.lists(); }, 'lists');
    for (var listIndex = 0; listIndex < lists.length; listIndex += 1) {
      pushList(lists[listIndex], accountEntry);
    }
  }

  if (state.accounts.length === 0 && topLevelLists.length > 0) {
    var syntheticAccount = {
      obj: null,
      id: 'all',
      name: 'All Reminders',
    };

    state.accounts.push(syntheticAccount);
    state.accountsById[syntheticAccount.id] = syntheticAccount;

    for (var topIndex = 0; topIndex < topLevelLists.length; topIndex += 1) {
      pushList(topLevelLists[topIndex], syntheticAccount);
    }
  }

  state.accounts.sort(function (a, b) {
    return normalize(a.name).localeCompare(normalize(b.name));
  });

  state.lists.sort(function (a, b) {
    var left = normalize(a.accountName + '/' + a.name);
    var right = normalize(b.accountName + '/' + b.name);
    return left.localeCompare(right);
  });

  return state;
}

function serializeAccount(entry, state) {
  var lists = state.lists.filter(function (listEntry) {
    return listEntry.accountId === entry.id;
  });

  var reminderCount = state.reminders.filter(function (reminderEntry) {
    return reminderEntry.accountId === entry.id;
  }).length;

  return {
    id: entry.id,
    name: entry.name,
    is_default: state.defaultAccountId === entry.id,
    list_count: lists.length,
    reminder_count: reminderCount,
  };
}

function serializeList(entry, state) {
  var reminderCount = state.reminders.filter(function (reminderEntry) {
    return reminderEntry.listId === entry.id;
  }).length;

  return {
    id: entry.id,
    name: entry.name,
    color: entry.color,
    emblem: entry.emblem,
    account_id: entry.accountId,
    account_name: entry.accountName,
    is_default: state.defaultListId === entry.id,
    reminder_count: reminderCount,
  };
}

function serializeReminder(entry) {
  return {
    id: entry.id,
    title: entry.title,
    body: entry.body,
    completed: entry.completed,
    completion_date: entry.completionDate,
    due_date: entry.dueDate,
    all_day_due_date: entry.allDayDueDate,
    remind_me_date: entry.remindMeDate,
    priority: entry.priority,
    flagged: entry.flagged,
    creation_date: entry.creationDate,
    modification_date: entry.modificationDate,
    list_id: entry.listId,
    list_name: entry.listName,
    account_id: entry.accountId,
    account_name: entry.accountName,
  };
}

function serializeReminderObject(reminderObj, listEntry, accountEntry) {
  return {
    id: safeCall(function () { return reminderObj.id(); }, ''),
    title: safeCall(function () { return reminderObj.name(); }, ''),
    body: cleanNullableText(safeCall(function () { return reminderObj.body(); }, '')),
    completed: toBoolean(safeCall(function () { return reminderObj.completed(); }, false), false),
    completion_date: toIsoDate(safeCall(function () { return reminderObj.completionDate(); }, null)),
    due_date: toIsoDate(safeCall(function () { return reminderObj.dueDate(); }, null)),
    all_day_due_date: toIsoDate(safeCall(function () { return reminderObj.alldayDueDate(); }, null)),
    remind_me_date: toIsoDate(safeCall(function () { return reminderObj.remindMeDate(); }, null)),
    priority: toInteger(safeCall(function () { return reminderObj.priority(); }, 0), 0, 0, 9),
    flagged: toBoolean(safeCall(function () { return reminderObj.flagged(); }, false), false),
    creation_date: toIsoDate(safeCall(function () { return reminderObj.creationDate(); }, null)),
    modification_date: toIsoDate(safeCall(function () { return reminderObj.modificationDate(); }, null)),
    list_id: listEntry.id,
    list_name: listEntry.name,
    account_id: accountEntry.id,
    account_name: accountEntry.name,
  };
}

function resolveAccount(state, payload, options) {
  var required = options && options.required;
  var accountId = typeof payload.account_id === 'string' ? payload.account_id.trim() : '';
  var accountName = typeof payload.account_name === 'string' ? payload.account_name.trim() : '';

  if (accountId) {
    var byId = state.accountsById[accountId];
    if (!byId) {
      throw new Error('No account found for account_id: ' + accountId);
    }
    return byId;
  }

  if (accountName) {
    var exactMatches = state.accounts.filter(function (entry) {
      return normalize(entry.name) === normalize(accountName);
    });

    if (exactMatches.length === 1) return exactMatches[0];
    if (exactMatches.length > 1) {
      throw new Error('Multiple accounts matched account_name: ' + accountName + '. Use account_id.');
    }

    var fuzzyMatches = state.accounts.filter(function (entry) {
      return normalize(entry.name).indexOf(normalize(accountName)) >= 0;
    });

    if (fuzzyMatches.length === 1) return fuzzyMatches[0];
    if (fuzzyMatches.length > 1) {
      throw new Error('Multiple accounts matched account_name: ' + accountName + '. Use account_id.');
    }

    throw new Error('No account found for account_name: ' + accountName);
  }

  if (required) {
    if (state.defaultAccountId && state.accountsById[state.defaultAccountId]) {
      return state.accountsById[state.defaultAccountId];
    }

    if (state.accounts.length > 0) {
      return state.accounts[0];
    }

    throw new Error('No Reminders accounts available.');
  }

  return null;
}

function pickListCandidates(state, accountEntry) {
  if (!accountEntry) {
    return state.lists.slice();
  }

  return state.lists.filter(function (entry) {
    return entry.accountId === accountEntry.id;
  });
}

function resolveList(state, payload, options) {
  var required = options && options.required;
  var listIdField = (options && options.listIdField) || 'list_id';
  var listNameField = (options && options.listNameField) || 'list_name';
  var accountEntry = resolveAccount(state, payload, { required: false });

  var listId = typeof payload[listIdField] === 'string' ? payload[listIdField].trim() : '';
  var listName = typeof payload[listNameField] === 'string' ? payload[listNameField].trim() : '';

  if (listId) {
    var byId = state.listsById[listId];
    if (!byId) {
      throw new Error('No list found for ' + listIdField + ': ' + listId);
    }

    if (accountEntry && byId.accountId !== accountEntry.id) {
      throw new Error('Selected list does not belong to the selected account.');
    }

    return byId;
  }

  if (listName) {
    var candidates = pickListCandidates(state, accountEntry);
    var exactMatches = candidates.filter(function (entry) {
      return normalize(entry.name) === normalize(listName);
    });

    if (exactMatches.length === 1) return exactMatches[0];
    if (exactMatches.length > 1) {
      throw new Error('Multiple lists matched ' + listNameField + ': ' + listName + '. Use list_id.');
    }

    var fuzzyMatches = candidates.filter(function (entry) {
      return normalize(entry.name).indexOf(normalize(listName)) >= 0;
    });

    if (fuzzyMatches.length === 1) return fuzzyMatches[0];
    if (fuzzyMatches.length > 1) {
      throw new Error('Multiple lists matched ' + listNameField + ': ' + listName + '. Use list_id.');
    }

    throw new Error('No list found for ' + listNameField + ': ' + listName);
  }

  if (required) {
    if (state.defaultListId && state.listsById[state.defaultListId]) {
      return state.listsById[state.defaultListId];
    }

    if (accountEntry) {
      var scopedLists = pickListCandidates(state, accountEntry);
      if (scopedLists.length > 0) return scopedLists[0];
    }

    if (state.lists.length > 0) {
      return state.lists[0];
    }

    throw new Error('No reminder lists available.');
  }

  return null;
}

function resolveReminder(state, payload, options) {
  var required = options && options.required;
  var reminderId = typeof payload.reminder_id === 'string' ? payload.reminder_id.trim() : '';

  if (!reminderId) {
    if (required) {
      throw new Error('Missing or invalid "reminder_id".');
    }
    return null;
  }

  var reminderEntry = state.remindersById[reminderId] || null;
  if (!reminderEntry) {
    if (required) {
      throw new Error('No reminder found for reminder_id: ' + reminderId);
    }
    return null;
  }

  var listEntry = resolveList(state, payload, { required: false });
  if (listEntry && reminderEntry.listId !== listEntry.id) {
    throw new Error('Reminder does not belong to the selected list.');
  }

  return reminderEntry;
}

function sortReminders(reminders) {
  return reminders.sort(function (a, b) {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    var aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    var bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;

    var aModified = a.modificationDate ? new Date(a.modificationDate).getTime() : 0;
    var bModified = b.modificationDate ? new Date(b.modificationDate).getTime() : 0;
    if (aModified !== bModified) return bModified - aModified;

    return normalize(a.title).localeCompare(normalize(b.title));
  });
}

function listAccounts(state) {
  return {
    accounts: state.accounts.map(function (entry) {
      return serializeAccount(entry, state);
    }),
    total_accounts: state.accounts.length,
    total_lists: state.lists.length,
    total_reminders: state.reminders.length,
  };
}

function listLists(state, payload) {
  var accountEntry = resolveAccount(state, payload, { required: false });
  var lists = pickListCandidates(state, accountEntry);

  return {
    account_scope: accountEntry
      ? { id: accountEntry.id, name: accountEntry.name }
      : { id: null, name: 'all' },
    total_lists: lists.length,
    lists: lists.map(function (entry) {
      return serializeList(entry, state);
    }),
  };
}

function filterReminderCandidates(state, payload) {
  var accountEntry = resolveAccount(state, payload, { required: false });
  var listEntry = resolveList(state, payload, { required: false });
  var hasCompleted = hasOwn(payload, 'completed');
  var completedFilter = hasCompleted ? toBoolean(payload.completed, false) : null;

  return state.reminders.filter(function (entry) {
    if (accountEntry && entry.accountId !== accountEntry.id) return false;
    if (listEntry && entry.listId !== listEntry.id) return false;
    if (completedFilter !== null && entry.completed !== completedFilter) return false;
    return true;
  });
}

function listReminders(state, payload) {
  var limit = toInteger(payload.limit, 100, 1, 1000);
  var reminders = filterReminderCandidates(state, payload);
  sortReminders(reminders);

  var selected = reminders.slice(0, limit);
  var listEntry = resolveList(state, payload, { required: false });
  var accountEntry = resolveAccount(state, payload, { required: false });

  return {
    account_scope: accountEntry ? { id: accountEntry.id, name: accountEntry.name } : null,
    list_scope: listEntry ? serializeList(listEntry, state) : null,
    total_matches: reminders.length,
    returned: selected.length,
    reminders: selected.map(function (entry) {
      return serializeReminder(entry);
    }),
  };
}

function getReminder(state, payload) {
  var reminderEntry = resolveReminder(state, payload, { required: true });

  return {
    reminder: serializeReminder(reminderEntry),
  };
}

function searchReminders(state, payload) {
  var query = requireNonEmptyString(payload.query, 'query');
  var limit = toInteger(payload.limit, 100, 1, 1000);
  var normalizedQuery = normalize(query);
  var reminders = filterReminderCandidates(state, payload).filter(function (entry) {
    return (
      normalize(entry.title).indexOf(normalizedQuery) >= 0 ||
      normalize(entry.body).indexOf(normalizedQuery) >= 0
    );
  });

  sortReminders(reminders);
  var selected = reminders.slice(0, limit);

  return {
    query: query,
    total_matches: reminders.length,
    returned: selected.length,
    reminders: selected.map(function (entry) {
      return serializeReminder(entry);
    }),
  };
}

function createList(app, payload) {
  var state = buildState(app, { includeReminders: false });
  var accountEntry = resolveAccount(state, payload, { required: true });
  var listName = requireNonEmptyString(payload.name, 'name');

  if (!accountEntry.obj) {
    throw new Error('Cannot create a list without a writable Reminders account reference.');
  }

  var listObj = app.List({ name: listName });
  accountEntry.obj.lists.push(listObj);

  var updatedState = buildState(app, { includeReminders: false });
  var createdList = updatedState.lists.find(function (entry) {
    return entry.id === safeCall(function () { return listObj.id(); }, '');
  });

  if (!createdList) {
    throw new Error('List was created but could not be reloaded.');
  }

  return {
    list: serializeList(createdList, updatedState),
    created_at: new Date().toISOString(),
  };
}

function updateList(app, payload) {
  var state = buildState(app, { includeReminders: false });
  var listEntry = resolveList(state, payload, { required: true });
  var nextName = requireNonEmptyString(payload.name, 'name');

  listEntry.obj.name = nextName;

  var updatedState = buildState(app, { includeReminders: false });
  var updatedList = updatedState.listsById[listEntry.id];

  if (!updatedList) {
    throw new Error('List was updated but could not be reloaded.');
  }

  return {
    list: serializeList(updatedList, updatedState),
    updated_at: new Date().toISOString(),
  };
}

function deleteList(app, payload) {
  var state = buildState(app, { includeReminders: false });
  var listEntry = resolveList(state, payload, { required: true });
  var snapshot = serializeList(listEntry, state);

  listEntry.obj.delete();

  return {
    deleted: true,
    list: snapshot,
    deleted_at: new Date().toISOString(),
  };
}

function createReminder(app, payload) {
  var state = buildState(app, { includeReminders: false });
  var targetList = resolveList(state, payload, { required: true });
  var title = requireNonEmptyString(payload.title, 'title');
  var targetAccount = state.accountsById[targetList.accountId] || {
    id: targetList.accountId,
    name: targetList.accountName,
  };

  var reminderProperties = {
    name: title,
  };

  if (hasOwn(payload, 'body')) {
    reminderProperties.body = cleanNullableText(payload.body);
  }

  if (hasOwn(payload, 'priority')) {
    reminderProperties.priority = toInteger(payload.priority, 0, 0, 9);
  }

  if (hasOwn(payload, 'flagged')) {
    reminderProperties.flagged = toBoolean(payload.flagged, false);
  }

  if (hasOwn(payload, 'due_date')) {
    reminderProperties.dueDate = parseDateInput(payload.due_date, 'due_date', null);
  }

  if (hasOwn(payload, 'all_day_due_date')) {
    reminderProperties.alldayDueDate = parseDateInput(payload.all_day_due_date, 'all_day_due_date', null);
    if (!hasOwn(payload, 'due_date')) {
      reminderProperties.dueDate = null;
    }
  }

  if (hasOwn(payload, 'remind_me_date')) {
    reminderProperties.remindMeDate = parseDateInput(payload.remind_me_date, 'remind_me_date', null);
  }

  var reminderObj = app.Reminder(reminderProperties);
  targetList.obj.reminders.push(reminderObj);

  return {
    reminder: serializeReminderObject(reminderObj, targetList, targetAccount),
    created_at: new Date().toISOString(),
  };
}

function updateReminder(app, payload) {
  var state = buildState(app);
  var reminderEntry = resolveReminder(state, payload, { required: true });

  var changed = false;

  if (hasOwn(payload, 'title')) {
    reminderEntry.obj.name = requireNonEmptyString(payload.title, 'title');
    changed = true;
  }

  if (hasOwn(payload, 'body')) {
    reminderEntry.obj.body = cleanNullableText(payload.body);
    changed = true;
  }

  if (hasOwn(payload, 'priority')) {
    reminderEntry.obj.priority = toInteger(payload.priority, 0, 0, 9);
    changed = true;
  }

  if (hasOwn(payload, 'flagged')) {
    reminderEntry.obj.flagged = toBoolean(payload.flagged, false);
    changed = true;
  }

  if (hasOwn(payload, 'completed')) {
    var nextCompleted = toBoolean(payload.completed, false);
    reminderEntry.obj.completed = nextCompleted;
    if (!nextCompleted) {
      reminderEntry.obj.completionDate = null;
    }
    changed = true;
  }

  if (hasOwn(payload, 'due_date')) {
    reminderEntry.obj.dueDate = parseDateInput(payload.due_date, 'due_date', null);
    if (!hasOwn(payload, 'all_day_due_date')) {
      reminderEntry.obj.alldayDueDate = null;
    }
    changed = true;
  }

  if (hasOwn(payload, 'all_day_due_date')) {
    reminderEntry.obj.alldayDueDate = parseDateInput(payload.all_day_due_date, 'all_day_due_date', null);
    if (!hasOwn(payload, 'due_date')) {
      reminderEntry.obj.dueDate = null;
    }
    changed = true;
  }

  if (hasOwn(payload, 'remind_me_date')) {
    reminderEntry.obj.remindMeDate = parseDateInput(payload.remind_me_date, 'remind_me_date', null);
    changed = true;
  }

  if (!changed) {
    throw new Error('Provide at least one field to update.');
  }

  var updatedState = buildState(app);
  var updatedReminder = updatedState.remindersById[reminderEntry.id];

  if (!updatedReminder) {
    throw new Error('Reminder was updated but could not be reloaded.');
  }

  return {
    reminder: serializeReminder(updatedReminder),
    updated_at: new Date().toISOString(),
  };
}

function deleteReminder(app, payload) {
  var state = buildState(app);
  var reminderEntry = resolveReminder(state, payload, { required: true });
  var snapshot = serializeReminder(reminderEntry);

  reminderEntry.obj.delete();

  return {
    deleted: true,
    reminder: snapshot,
    deleted_at: new Date().toISOString(),
  };
}

function setReminderCompleted(app, payload, completedValue) {
  var state = buildState(app);
  var reminderEntry = resolveReminder(state, payload, { required: true });

  reminderEntry.obj.completed = completedValue;
  if (!completedValue) {
    reminderEntry.obj.completionDate = null;
  }

  var updatedState = buildState(app);
  var updatedReminder = updatedState.remindersById[reminderEntry.id];

  if (!updatedReminder) {
    throw new Error('Reminder was updated but could not be reloaded.');
  }

  return {
    reminder: serializeReminder(updatedReminder),
    updated_at: new Date().toISOString(),
  };
}

function moveReminder(app, payload) {
  var state = buildState(app);
  var reminderEntry = resolveReminder(state, payload, { required: true });
  var targetList = resolveList(state, payload, {
    required: true,
    listIdField: 'target_list_id',
    listNameField: 'target_list_name',
  });

  if (reminderEntry.listId === targetList.id) {
    return {
      reminder: serializeReminder(reminderEntry),
      moved: false,
    };
  }

  app.move(reminderEntry.obj, { to: targetList.obj });

  var updatedState = buildState(app);
  var movedReminder = updatedState.remindersById[reminderEntry.id];

  if (!movedReminder) {
    throw new Error('Reminder was moved but could not be reloaded.');
  }

  return {
    reminder: serializeReminder(movedReminder),
    moved: true,
    updated_at: new Date().toISOString(),
  };
}

function cleanupCompleted(app, payload) {
  var state = buildState(app);
  var listEntry = resolveList(state, payload, { required: false });
  var beforeDate = hasOwn(payload, 'before') ? parseDateInput(payload.before, 'before', null) : null;

  var candidates = state.reminders.filter(function (entry) {
    if (!entry.completed) return false;
    if (listEntry && entry.listId !== listEntry.id) return false;
    if (beforeDate && !isDateBefore(entry.completionDate, beforeDate)) return false;
    return true;
  });

  var deleted = [];

  for (var index = 0; index < candidates.length; index += 1) {
    deleted.push(serializeReminder(candidates[index]));
    candidates[index].obj.delete();
  }

  return {
    list_scope: listEntry ? serializeList(listEntry, state) : null,
    deleted_count: deleted.length,
    reminders: deleted,
    deleted_at: new Date().toISOString(),
  };
}

function duplicateKey(entry) {
  var dueKey = entry.dueDate || entry.allDayDueDate || '';
  return [
    entry.listId,
    normalize(entry.title),
    normalize(entry.body),
    dueKey,
    entry.completed ? 'completed' : 'open',
  ].join('|');
}

function duplicateSortValue(entry) {
  if (entry.creationDate) {
    var creationTime = new Date(entry.creationDate).getTime();
    if (!Number.isNaN(creationTime)) return creationTime;
  }

  if (entry.modificationDate) {
    var modifiedTime = new Date(entry.modificationDate).getTime();
    if (!Number.isNaN(modifiedTime)) return modifiedTime;
  }

  return Number.MAX_SAFE_INTEGER;
}

function cleanupDuplicates(app, payload) {
  var state = buildState(app);
  var listEntry = resolveList(state, payload, { required: false });
  var candidates = state.reminders.filter(function (entry) {
    if (listEntry && entry.listId !== listEntry.id) return false;
    return true;
  });

  var groups = {};

  for (var index = 0; index < candidates.length; index += 1) {
    var entry = candidates[index];
    var key = duplicateKey(entry);
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  var kept = [];
  var deleted = [];

  Object.keys(groups).forEach(function (key) {
    var entries = groups[key];
    if (entries.length < 2) return;

    entries.sort(function (a, b) {
      var left = duplicateSortValue(a);
      var right = duplicateSortValue(b);
      if (left !== right) return left - right;
      return normalize(a.id).localeCompare(normalize(b.id));
    });

    kept.push(serializeReminder(entries[0]));

    for (var entryIndex = 1; entryIndex < entries.length; entryIndex += 1) {
      deleted.push(serializeReminder(entries[entryIndex]));
      entries[entryIndex].obj.delete();
    }
  });

  return {
    list_scope: listEntry ? serializeList(listEntry, state) : null,
    duplicate_groups: kept.length,
    kept_count: kept.length,
    deleted_count: deleted.length,
    kept: kept,
    deleted: deleted,
    deleted_at: new Date().toISOString(),
  };
}

function runOperation(app, operation, payload) {
  var state = null;

  switch (operation) {
    case 'list_accounts':
      state = buildState(app, { includeReminders: false });
      return listAccounts(state);

    case 'list_lists':
      state = buildState(app, { includeReminders: false });
      return listLists(state, payload);

    case 'list_reminders':
      state = buildState(app);
      return listReminders(state, payload);

    case 'get_reminder':
      state = buildState(app);
      return getReminder(state, payload);

    case 'search_reminders':
      state = buildState(app);
      return searchReminders(state, payload);

    case 'create_list':
      return createList(app, payload);

    case 'update_list':
      return updateList(app, payload);

    case 'delete_list':
      return deleteList(app, payload);

    case 'create_reminder':
      return createReminder(app, payload);

    case 'update_reminder':
      return updateReminder(app, payload);

    case 'delete_reminder':
      return deleteReminder(app, payload);

    case 'complete_reminder':
      return setReminderCompleted(app, payload, true);

    case 'uncomplete_reminder':
      return setReminderCompleted(app, payload, false);

    case 'move_reminder':
      return moveReminder(app, payload);

    case 'cleanup_completed':
      return cleanupCompleted(app, payload);

    case 'cleanup_duplicates':
      return cleanupDuplicates(app, payload);

    default:
      throw new Error('Unsupported operation: ' + operation);
  }
}

(function main() {
  try {
    var operation = getEnv('MCP_REMINDERS_OPERATION');
    if (!operation) {
      throw new Error('Missing MCP_REMINDERS_OPERATION environment variable.');
    }

    var payloadRaw = getEnv('MCP_REMINDERS_PAYLOAD');
    var payload = payloadRaw ? JSON.parse(payloadRaw) : {};

    var app = Application('/System/Applications/Reminders.app');
    app.includeStandardAdditions = true;
    ensureAppReady(app);

    var result = runOperation(app, operation, payload);

    console.log(
      JSON.stringify({
        ok: true,
        result: result,
      })
    );
  } catch (error) {
    var message = error && error.message ? String(error.message) : String(error);

    console.log(
      JSON.stringify({
        ok: false,
        error: message,
      })
    );
  }
})();
`;
