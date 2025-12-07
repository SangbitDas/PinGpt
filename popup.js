// popup.js - Works with the new chrome.storage.sync system
document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("PinGPTChat: Popup loading...");

    // Full page view button functionality
    const fullPageViewBtn = document.getElementById("fullPageViewBtn");
    fullPageViewBtn.addEventListener("click", () => {
      // Open full page view in new tab
      chrome.tabs.create({
        url: chrome.runtime.getURL("fullpage.html")
      });
      window.close(); // Close popup after opening full page
    });

    // Load and display pinned chats
    await loadPinnedChats();

  } catch (error) {
    console.error("PinGPTChat: Error initializing popup:", error);
  }
});

async function loadPinnedChats() {
  try {
    console.log("PinGPTChat: Loading pinned chats...");

    // Use chrome.storage.sync for consistency with content script
    const result = await chrome.storage.sync.get('PinGPTChat-pinned-chats');
    const pinnedChats = result['PinGPTChat-pinned-chats'] || [];

    const container = document.getElementById("pinned");
    container.innerHTML = "";

    if (pinnedChats.length === 0) {
      container.innerHTML = '<div style="padding: 10px; color: #666; font-style: italic;">No pinned chats yet.</div>';
      console.log("PinGPTChat: No pinned chats found");
      return;
    }

    console.log(`PinGPTChat: Loading ${pinnedChats.length} pinned chats`);

    pinnedChats.forEach((chat) => {
       const link = document.createElement("a");
       link.href = `https://chat.openai.com/c/${chat.id}`;
       link.target = "_blank";
       link.style.cssText = `
         display: block;
         margin: 5px 0;
         padding: 8px 12px;
         background: #f5f5f5;
         border-radius: 6px;
         color: #1e88e5;
         text-decoration: none;
         font-size: 14px;
         border-left: 3px solid #1e88e5;
         transition: background-color 0.2s;
       `;

       // Show only chat name
       link.innerHTML = `
         <div style="font-weight: bold;">${chat.name}</div>
       `;

       link.title = `Open chat: ${chat.name}`;

       // Add hover effect
       link.onmouseover = () => {
         link.style.backgroundColor = '#e8f0fe';
       };
       link.onmouseout = () => {
         link.style.backgroundColor = '#f5f5f5';
       };

       container.appendChild(link);
     });

  } catch (error) {
    console.error("PinGPTChat: Error loading pinned chats in popup:", error);
    const container = document.getElementById("pinned");
    container.innerHTML = '<div style="padding: 10px; color: red;">Error loading pinned chats.</div>';
  }
}
