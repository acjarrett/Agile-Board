import * as SDK from "azure-devops-extension-sdk";

SDK.init();
SDK.ready()
  .then(() => {
    try {
      const webContext = SDK.getWebContext();
      const project = (webContext && webContext.project && webContext.project.name) || "";
      const team = (webContext && webContext.team && webContext.team.name) || "";

      const baseUrl = "https://agile-board-amct.onrender.com"; // Render app URL
      const frame = document.getElementById("agileBoardFrame");
      if (frame) {
        frame.src = `${baseUrl}/?project=${encodeURIComponent(project)}&team=${encodeURIComponent(team)}`;
        frame.onload = () => {
          const loading = document.getElementById("loading");
          if (loading) loading.style.display = "none";
          frame.style.display = "block";
        };
      }

      SDK.notifyLoadSucceeded();
    } catch (e) {
      console.error("Extension init error", e);
      try { SDK.notifyLoadFailed((e && e.message) ? e.message : "Load failed"); } catch (_) {}
    }
  })
  .catch((err) => {
    console.error("SDK ready error", err);
  });
