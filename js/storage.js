/**
 * Storage Module (localStorage + Supabase sync)
 * Keeps the existing sync read API for the UI while syncing to Supabase
 * after sign-in.
 */
window.Storage = (function() {
  'use strict';

  var FAV_KEY = 'hyp_zodiac_favorites';
  var NOTES_KEY = 'hyp_zodiac_notes';
  var favoritesCache = [];
  var notesCache = {};
  var activeUserId = '';
  var authBound = false;
  var syncVersion = 0;
  var readyPromise = Promise.resolve();

  function getClient() {
    return window.SupabaseClient || null;
  }

  function cloneNotes(notes) {
    return Object.assign({}, notes || {});
  }

  function readLocalFavorites() {
    try {
      var data = localStorage.getItem(FAV_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('读取本地收藏失败:', error);
      return [];
    }
  }

  function writeLocalFavorites(list) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(list || []));
    } catch (error) {
      console.error('保存本地收藏失败:', error);
    }
  }

  function readLocalNotes() {
    try {
      var data = localStorage.getItem(NOTES_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('读取本地笔记失败:', error);
      return {};
    }
  }

  function writeLocalNotes(notes) {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes || {}));
    } catch (error) {
      console.error('保存本地笔记失败:', error);
    }
  }

  function persistLocalSnapshot() {
    writeLocalFavorites(favoritesCache);
    writeLocalNotes(notesCache);
  }

  function setCaches(favorites, notes) {
    favoritesCache = Array.isArray(favorites) ? favorites.slice() : [];
    notesCache = cloneNotes(notes);
    persistLocalSnapshot();
  }

  function notifyFavoritesChange() {
    window.dispatchEvent(new CustomEvent('favorites:changed'));
  }

  function notifyNotesChange() {
    window.dispatchEvent(new CustomEvent('notes:changed'));
  }

  function notifyAll() {
    notifyFavoritesChange();
    notifyNotesChange();
  }

  function mergeFavorites(localFavorites, remoteFavorites) {
    var merged = [];
    var seen = {};
    (remoteFavorites || []).concat(localFavorites || []).forEach(function(id) {
      if (!id || seen[id]) return;
      seen[id] = true;
      merged.push(id);
    });
    return merged;
  }

  function mergeNotes(remoteNotes, localNotes) {
    var merged = cloneNotes(remoteNotes);
    Object.keys(localNotes || {}).forEach(function(id) {
      var value = localNotes[id];
      if (value && String(value).trim()) {
        merged[id] = value;
      }
    });
    return merged;
  }

  async function loadCloudSnapshot(userId) {
    var client = getClient();
    if (!client || !userId) {
      return {
        favorites: [],
        notes: {}
      };
    }

    var favResult = await client
      .from('user_favorites')
      .select('sign_id')
      .eq('user_id', userId);
    if (favResult.error) throw favResult.error;

    var noteResult = await client
      .from('user_notes')
      .select('sign_id, content')
      .eq('user_id', userId);
    if (noteResult.error) throw noteResult.error;

    var notes = {};
    (noteResult.data || []).forEach(function(row) {
      notes[row.sign_id] = row.content || '';
    });

    return {
      favorites: (favResult.data || []).map(function(row) {
        return row.sign_id;
      }),
      notes: notes
    };
  }

  async function upsertCloudSnapshot(userId, favorites, notes) {
    var client = getClient();
    if (!client || !userId) return;

    if (favorites && favorites.length) {
      var favoriteRows = favorites.map(function(signId) {
        return {
          user_id: userId,
          sign_id: signId
        };
      });
      var favUpsert = await client
        .from('user_favorites')
        .upsert(favoriteRows, { onConflict: 'user_id,sign_id' });
      if (favUpsert.error) throw favUpsert.error;
    }

    var noteIds = Object.keys(notes || {});
    if (noteIds.length) {
      var noteRows = noteIds
        .filter(function(signId) {
          return notes[signId] && String(notes[signId]).trim();
        })
        .map(function(signId) {
          return {
            user_id: userId,
            sign_id: signId,
            content: notes[signId]
          };
        });

      if (noteRows.length) {
        var noteUpsert = await client
          .from('user_notes')
          .upsert(noteRows, { onConflict: 'user_id,sign_id' });
        if (noteUpsert.error) throw noteUpsert.error;
      }
    }
  }

  async function deleteCloudFavorite(userId, signId) {
    var client = getClient();
    if (!client || !userId) return;

    var result = await client
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('sign_id', signId);
    if (result.error) throw result.error;
  }

  async function upsertCloudFavorite(userId, signId) {
    var client = getClient();
    if (!client || !userId) return;

    var result = await client
      .from('user_favorites')
      .upsert([{ user_id: userId, sign_id: signId }], { onConflict: 'user_id,sign_id' });
    if (result.error) throw result.error;
  }

  async function upsertCloudNote(userId, signId, content) {
    var client = getClient();
    if (!client || !userId) return;

    if (content && String(content).trim()) {
      var upsertResult = await client
        .from('user_notes')
        .upsert([{
          user_id: userId,
          sign_id: signId,
          content: content
        }], { onConflict: 'user_id,sign_id' });
      if (upsertResult.error) throw upsertResult.error;
      return;
    }

    var deleteResult = await client
      .from('user_notes')
      .delete()
      .eq('user_id', userId)
      .eq('sign_id', signId);
    if (deleteResult.error) throw deleteResult.error;
  }

  async function clearCloudSnapshot(userId) {
    var client = getClient();
    if (!client || !userId) return;

    var favoritesResult = await client
      .from('user_favorites')
      .delete()
      .eq('user_id', userId);
    if (favoritesResult.error) throw favoritesResult.error;

    var notesResult = await client
      .from('user_notes')
      .delete()
      .eq('user_id', userId);
    if (notesResult.error) throw notesResult.error;
  }

  async function syncSignedInUser(user) {
    var version = ++syncVersion;
    var client = getClient();

    if (!user || !user.id || !client) {
      activeUserId = '';
      setCaches(readLocalFavorites(), readLocalNotes());
      notifyAll();
      return;
    }

    activeUserId = user.id;

    try {
      var remote = await loadCloudSnapshot(user.id);
      if (version !== syncVersion) return;

      var mergedFavorites = mergeFavorites(readLocalFavorites(), remote.favorites);
      var mergedNotes = mergeNotes(remote.notes, readLocalNotes());

      await upsertCloudSnapshot(user.id, mergedFavorites, mergedNotes);
      if (version !== syncVersion) return;

      setCaches(mergedFavorites, mergedNotes);
      notifyAll();
    } catch (error) {
      console.error('同步云端数据失败:', error);
      setCaches(readLocalFavorites(), readLocalNotes());
      notifyAll();
    }
  }

  function scheduleCloudFavoriteSync(signId, shouldExist) {
    if (!activeUserId || !getClient()) return;

    readyPromise = Promise.resolve(readyPromise).then(function() {
      return shouldExist
        ? upsertCloudFavorite(activeUserId, signId)
        : deleteCloudFavorite(activeUserId, signId);
    }).catch(function(error) {
      console.error('同步收藏失败:', error);
    });
  }

  function scheduleCloudNoteSync(signId, content) {
    if (!activeUserId || !getClient()) return;

    readyPromise = Promise.resolve(readyPromise).then(function() {
      return upsertCloudNote(activeUserId, signId, content);
    }).catch(function(error) {
      console.error('同步笔记失败:', error);
    });
  }

  function scheduleCloudClear() {
    if (!activeUserId || !getClient()) return;

    readyPromise = Promise.resolve(readyPromise).then(function() {
      return clearCloudSnapshot(activeUserId);
    }).catch(function(error) {
      console.error('清空云端数据失败:', error);
    });
  }

  function bindAuthListener() {
    if (authBound) return;
    authBound = true;

    window.addEventListener('auth:changed', function(event) {
      var user = event.detail ? event.detail.user : null;
      readyPromise = syncSignedInUser(user);
    });
  }

  function init() {
    setCaches(readLocalFavorites(), readLocalNotes());
    bindAuthListener();
    return readyPromise;
  }

  function ready() {
    return readyPromise;
  }

  var Favorites = {
    getAll: function() {
      return favoritesCache.slice();
    },

    has: function(id) {
      return favoritesCache.indexOf(id) !== -1;
    },

    toggle: function(id) {
      var exists = favoritesCache.indexOf(id) !== -1;
      if (exists) {
        favoritesCache = favoritesCache.filter(function(item) {
          return item !== id;
        });
      } else {
        favoritesCache.push(id);
      }
      persistLocalSnapshot();
      notifyFavoritesChange();
      scheduleCloudFavoriteSync(id, !exists);
      return !exists;
    },

    add: function(id) {
      if (favoritesCache.indexOf(id) === -1) {
        favoritesCache.push(id);
        persistLocalSnapshot();
        notifyFavoritesChange();
        scheduleCloudFavoriteSync(id, true);
      }
    },

    remove: function(id) {
      if (favoritesCache.indexOf(id) !== -1) {
        favoritesCache = favoritesCache.filter(function(item) {
          return item !== id;
        });
        persistLocalSnapshot();
        notifyFavoritesChange();
        scheduleCloudFavoriteSync(id, false);
      }
    },

    count: function() {
      return favoritesCache.length;
    },

    clear: function() {
      favoritesCache = [];
      persistLocalSnapshot();
      notifyFavoritesChange();
      scheduleCloudClear();
    }
  };

  var Notes = {
    get: function(id) {
      return notesCache[id] || '';
    },

    set: function(id, text) {
      if (text && String(text).trim()) {
        notesCache[id] = text;
      } else {
        delete notesCache[id];
      }
      persistLocalSnapshot();
      notifyNotesChange();
      scheduleCloudNoteSync(id, notesCache[id] || '');
    },

    getAll: function() {
      return cloneNotes(notesCache);
    },

    has: function(id) {
      return Boolean(notesCache[id] && String(notesCache[id]).length > 0);
    },

    exportJSON: function() {
      return JSON.stringify({
        exportDate: new Date().toISOString(),
        favorites: Favorites.getAll(),
        notes: cloneNotes(notesCache)
      }, null, 2);
    },

    importJSON: function(jsonString) {
      try {
        var data = JSON.parse(jsonString);
        favoritesCache = Array.isArray(data.favorites) ? data.favorites.slice() : [];
        notesCache = cloneNotes(data.notes);
        persistLocalSnapshot();
        notifyAll();

        if (activeUserId && getClient()) {
          readyPromise = Promise.resolve(readyPromise).then(function() {
            return upsertCloudSnapshot(activeUserId, favoritesCache, notesCache);
          }).catch(function(error) {
            console.error('导入后同步云端失败:', error);
          });
        }
        return true;
      } catch (error) {
        console.error('导入笔记失败:', error);
        return false;
      }
    },

    clear: function() {
      notesCache = {};
      persistLocalSnapshot();
      notifyNotesChange();
      scheduleCloudClear();
    }
  };

  function clearAll() {
    favoritesCache = [];
    notesCache = {};
    persistLocalSnapshot();
    notifyAll();
    scheduleCloudClear();
  }

  function handleAuthChange(user) {
    readyPromise = syncSignedInUser(user);
    return readyPromise;
  }

  return {
    Favorites: Favorites,
    Notes: Notes,
    clearAll: clearAll,
    init: init,
    ready: ready,
    handleAuthChange: handleAuthChange
  };
})();
