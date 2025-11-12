(() => {
  // node_modules/azure-devops-extension-sdk/esm/SDK.min.js
  var e = parseInt("10000000000", 36);
  var t = Number.MAX_SAFE_INTEGER || 9007199254740991;
  var n = class {
    objects = {};
    register(e2, t2) {
      this.objects[e2] = t2;
    }
    unregister(e2) {
      delete this.objects[e2];
    }
    getInstance(e2, t2) {
      var n2 = this.objects[e2];
      if (n2) return "function" == typeof n2 ? n2(t2) : n2;
    }
  };
  var o = 1;
  var r = class {
    promises = {};
    postToWindow;
    targetOrigin;
    handshakeToken;
    registry;
    channelId;
    nextMessageId = 1;
    nextProxyId = 1;
    proxyFunctions = {};
    constructor(r2, i2) {
      this.postToWindow = r2, this.targetOrigin = i2, this.registry = new n(), this.channelId = o++, this.targetOrigin || (this.handshakeToken = Math.floor(Math.random() * (t - e) + e).toString(36) + Math.floor(Math.random() * (t - e) + e).toString(36));
    }
    getObjectRegistry() {
      return this.registry;
    }
    async invokeRemoteMethod(e2, t2, n2, o2, r2) {
      const i2 = { id: this.nextMessageId++, methodName: e2, instanceId: t2, instanceContext: o2, params: this._customSerializeObject(n2, r2), serializationSettings: r2 };
      this.targetOrigin || (i2.handshakeToken = this.handshakeToken);
      const s2 = new Promise((e3, t3) => {
        this.promises[i2.id] = { resolve: e3, reject: t3 };
      });
      return this._sendRpcMessage(i2), s2;
    }
    getRemoteObjectProxy(e2, t2) {
      return this.invokeRemoteMethod("", e2, void 0, t2);
    }
    invokeMethod(e2, t2) {
      if (t2.methodName) {
        var n2 = e2[t2.methodName];
        if ("function" == typeof n2) try {
          var o2 = [];
          t2.params && (o2 = this._customDeserializeObject(t2.params, {}));
          var r2 = n2.apply(e2, o2);
          r2 && r2.then && "function" == typeof r2.then ? r2.then((e3) => {
            this._success(t2, e3, t2.handshakeToken);
          }, (e3) => {
            this.error(t2, e3);
          }) : this._success(t2, r2, t2.handshakeToken);
        } catch (e3) {
          this.error(t2, e3);
        }
        else this.error(t2, new Error("RPC method not found: " + t2.methodName));
      } else this._success(t2, e2, t2.handshakeToken);
    }
    getRegisteredObject(e2, t2) {
      if ("__proxyFunctions" === e2) return this.proxyFunctions;
      var n2 = this.registry.getInstance(e2, t2);
      return n2 || (n2 = i.getInstance(e2, t2)), n2;
    }
    onMessage(e2) {
      if (e2.instanceId) {
        const t2 = this.getRegisteredObject(e2.instanceId, e2.instanceContext);
        if (!t2) return false;
        "function" == typeof t2.then ? t2.then((t3) => {
          this.invokeMethod(t3, e2);
        }, (t3) => {
          this.error(e2, t3);
        }) : this.invokeMethod(t2, e2);
      } else {
        const t2 = this.promises[e2.id];
        if (!t2) return false;
        e2.error ? t2.reject(this._customDeserializeObject([e2.error], {})[0]) : t2.resolve(this._customDeserializeObject([e2.result], {})[0]), delete this.promises[e2.id];
      }
      return true;
    }
    owns(e2, t2, n2) {
      if (this.postToWindow === e2) {
        if (this.targetOrigin) return !!t2 && ("null" === t2.toLowerCase() || 0 === this.targetOrigin.toLowerCase().indexOf(t2.toLowerCase()));
        if (n2.handshakeToken && n2.handshakeToken === this.handshakeToken) return this.targetOrigin = t2, true;
      }
      return false;
    }
    error(e2, t2) {
      this._sendRpcMessage({ id: e2.id, error: this._customSerializeObject([t2], e2.serializationSettings)[0], handshakeToken: e2.handshakeToken });
    }
    _success(e2, t2, n2) {
      this._sendRpcMessage({ id: e2.id, result: this._customSerializeObject([t2], e2.serializationSettings)[0], handshakeToken: n2 });
    }
    _sendRpcMessage(e2) {
      this.postToWindow.postMessage(JSON.stringify(e2), "*");
    }
    _customSerializeObject(e2, t2, n2, o2 = 1, r2 = 1) {
      if (!e2 || r2 > 100) return;
      if (e2 instanceof Node || e2 instanceof Window || e2 instanceof Event) return;
      var i2;
      let s2;
      s2 = n2 || { newObjects: [], originalObjects: [] }, s2.originalObjects.push(e2);
      var c = (n3, i3, c2) => {
        var a3;
        try {
          a3 = n3[c2];
        } catch (e3) {
        }
        var h3 = typeof a3;
        if ("undefined" !== h3) {
          var d3 = -1;
          if ("object" === h3 && (d3 = s2.originalObjects.indexOf(a3)), d3 >= 0) {
            var u2 = s2.newObjects[d3];
            u2.__circularReferenceId || (u2.__circularReferenceId = o2++), i3[c2] = { __circularReference: u2.__circularReferenceId };
          } else "function" === h3 ? (this.nextProxyId++, i3[c2] = { __proxyFunctionId: this._registerProxyFunction(a3, e2), _channelId: this.channelId }) : "object" === h3 ? a3 && a3 instanceof Date ? i3[c2] = { __proxyDate: a3.getTime() } : i3[c2] = this._customSerializeObject(a3, t2, s2, o2, r2 + 1) : "__proxyFunctionId" !== c2 && (i3[c2] = a3);
        }
      };
      if (e2 instanceof Array) {
        i2 = [], s2.newObjects.push(i2);
        for (var a2 = 0, h2 = e2.length; a2 < h2; a2++) c(e2, i2, a2);
      } else {
        i2 = {}, s2.newObjects.push(i2);
        let n3 = {};
        try {
          n3 = function(e3) {
            const t3 = {};
            for (; e3 && e3 !== Object.prototype; ) {
              const n4 = Object.getOwnPropertyNames(e3);
              for (const e4 of n4) "constructor" !== e4 && (t3[e4] = true);
              e3 = Object.getPrototypeOf(e3);
            }
            return t3;
          }(e2);
        } catch (e3) {
        }
        for (var d2 in n3) (d2 && "_" !== d2[0] || t2 && t2.includeUnderscoreProperties) && c(e2, i2, d2);
      }
      return s2.originalObjects.pop(), s2.newObjects.pop(), i2;
    }
    _registerProxyFunction(e2, t2) {
      var n2 = this.nextProxyId++;
      return this.proxyFunctions["proxy" + n2] = function() {
        return e2.apply(t2, Array.prototype.slice.call(arguments, 0));
      }, n2;
    }
    _customDeserializeObject(e2, t2) {
      var n2 = this;
      if (!e2) return null;
      var o2 = (e3, o3) => {
        var r3 = e3[o3], i3 = typeof r3;
        "__circularReferenceId" === o3 && "number" === i3 ? (t2[r3] = e3, delete e3[o3]) : "object" === i3 && r3 && (r3.__proxyFunctionId ? e3[o3] = function() {
          return n2.invokeRemoteMethod("proxy" + r3.__proxyFunctionId, "__proxyFunctions", Array.prototype.slice.call(arguments, 0), {}, { includeUnderscoreProperties: true });
        } : r3.__proxyDate ? e3[o3] = new Date(r3.__proxyDate) : r3.__circularReference ? e3[o3] = t2[r3.__circularReference] : this._customDeserializeObject(r3, t2));
      };
      if (e2 instanceof Array) for (var r2 = 0, i2 = e2.length; r2 < i2; r2++) o2(e2, r2);
      else if ("object" == typeof e2) for (var s2 in e2) o2(e2, s2);
      return e2;
    }
  };
  var i = new n();
  var s = new class {
    _channels = [];
    constructor() {
      window.addEventListener("message", this._handleMessageReceived);
    }
    addChannel(e2, t2) {
      const n2 = new r(e2, t2);
      return this._channels.push(n2), n2;
    }
    removeChannel(e2) {
      this._channels = this._channels.filter((t2) => t2 !== e2);
    }
    _handleMessageReceived = (e2) => {
      let t2;
      if ("string" == typeof e2.data) try {
        t2 = JSON.parse(e2.data);
      } catch (e3) {
      }
      if (t2) {
        let n2, o2 = false;
        for (const r2 of this._channels) r2.owns(e2.source, e2.origin, t2) && (n2 = r2, o2 = r2.onMessage(t2) || o2);
        n2 && !o2 && (window.console && console.error(`No handler found on any channel for message: ${JSON.stringify(t2)}`), t2.instanceId && n2.error(t2, new Error(`The registered object ${t2.instanceId} could not be found.`)));
      }
    };
  }();
  var a = window;
  var h;
  a._AzureDevOpsSDKVersion && console.error("The AzureDevOps SDK is already loaded. Only one version of this module can be loaded in a given document."), a._AzureDevOpsSDKVersion = 4.2, function(e2) {
    e2[e2.Unknown = 0] = "Unknown", e2[e2.Deployment = 1] = "Deployment", e2[e2.Enterprise = 2] = "Enterprise", e2[e2.Organization = 4] = "Organization";
  }(h || (h = {}));
  var d = "DevOps.HostControl";
  var u = s.addChannel(window.parent);
  var l;
  var f;
  var g;
  var p;
  var m;
  var y;
  var v;
  var _;
  var b;
  var w;
  var O = new Promise((e2) => {
    w = e2;
  });
  function x(e2, t2) {
    const n2 = window;
    let o2;
    "function" == typeof n2.CustomEvent ? o2 = new n2.CustomEvent(e2, t2) : (t2 = t2 || { bubbles: false, cancelable: false }, o2 = document.createEvent("CustomEvent"), o2.initCustomEvent(e2, t2.bubbles, t2.cancelable, t2.detail)), window.dispatchEvent(o2);
  }
  function k(e2) {
    return new Promise((t2) => {
      const n2 = { ...e2, sdkVersion: 4.2 };
      u.invokeRemoteMethod("initialHandshake", d, [n2]).then((e3) => {
        if ("pageContext" in e3) {
          const t3 = e3;
          if (g = t3.pageContext, f = g ? g.webContext : void 0, l = f ? f.team : void 0, m = t3.initialConfig || {}, y = t3.contribution.id, p = t3.extensionContext, p.id = p.publisherId + "." + p.extensionId, "context" in e3) {
            const t4 = e3.context;
            v = t4.user, _ = t4.host;
          }
        } else {
          const t3 = e3, n3 = t3.context;
          g = n3.pageContext, f = g ? g.webContext : void 0, l = f ? f.team : void 0, m = t3.initialConfig || {}, y = t3.contributionId, p = n3.extension, v = n3.user, _ = n3.host;
        }
        e3.themeData && (J(e3.themeData), window.addEventListener("themeChanged", (e4) => {
          J(e4.detail.data);
        })), w(), t2();
      });
    });
  }
  async function j() {
    return O;
  }
  function R() {
    return u.invokeRemoteMethod("notifyLoadSucceeded", d);
  }
  function C(e2) {
    return u.invokeRemoteMethod("notifyLoadFailed", d, [e2]);
  }
  function I(e2) {
    return `Attempted to call ${e2}() before init() was complete. Wait for init to complete or place within a ready() callback.`;
  }
  function A() {
    if (!f) throw new Error(I("getWebContext"));
    return f;
  }
  function J(e2) {
    b || (b = document.createElement("style"), b.type = "text/css", document.head.appendChild(b));
    const t2 = [];
    if (e2) for (const n2 in e2) t2.push("--" + n2 + ": " + e2[n2]);
    b.innerText = ":root { " + t2.join("; ") + " } body { color: var(--text-primary-color) }", x("themeApplied", { detail: e2 });
  }
  u.getObjectRegistry().register("DevOps.SdkClient", { dispatchEvent: x });

  // src/my-board.js
  k();
  j().then(() => {
    try {
      const webContext = A();
      const project = webContext && webContext.project && webContext.project.name || "";
      const team = webContext && webContext.team && webContext.team.name || "";
      const baseUrl = "https://agile-board-amct.onrender.com";
      const frame = document.getElementById("agileBoardFrame");
      if (frame) {
        frame.src = `${baseUrl}/?project=${encodeURIComponent(project)}&team=${encodeURIComponent(team)}`;
        frame.onload = () => {
          const loading = document.getElementById("loading");
          if (loading) loading.style.display = "none";
          frame.style.display = "block";
        };
      }
      R();
    } catch (e2) {
      console.error("Extension init error", e2);
      try {
        C(e2 && e2.message ? e2.message : "Load failed");
      } catch (_2) {
      }
    }
  }).catch((err) => {
    console.error("SDK ready error", err);
  });
})();
