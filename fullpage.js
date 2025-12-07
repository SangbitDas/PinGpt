// fullpage.js - Full page view for pinned chats
let currentChatForCategory = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("PinGPTChat: Full page view loading...");

    // Use chrome.storage.sync for consistency with content script
    const result = await chrome.storage.sync.get('PinGPTChat-pinned-chats');
    const pinnedChats = result['PinGPTChat-pinned-chats'] || [];

    const loadingDiv = document.getElementById("loading");
    const pinnedChatsDiv = document.getElementById("pinned-chats");
    const emptyStateDiv = document.getElementById("empty-state");
    const searchInput = document.getElementById("searchInput");
    const categoryModal = document.getElementById("categoryModal");
    const closeCategoryModal = document.getElementById("closeCategoryModal");
    const categoryList = document.getElementById("categoryList");
    const newCategoryInput = document.getElementById("newCategoryInput");
    const createCategoryBtn = document.getElementById("createCategoryBtn");
    const categoryFilter = document.getElementById("categoryFilter");
    const allCategoriesBtn = document.getElementById("allCategoriesBtn");
    const manageCategoriesBtn = document.getElementById("manageCategoriesBtn");
    const manageCategoriesModal = document.getElementById("manageCategoriesModal");
    const closeManageModal = document.getElementById("closeManageModal");
    const manageCategoryInput = document.getElementById("manageCategoryInput");
    const createFromManageBtn = document.getElementById("createFromManageBtn");
    const searchCategoriesInput = document.getElementById("searchCategoriesInput");
    const categoriesList = document.getElementById("categoriesList");

    // Store all chats for search functionality
    let allChats = [];
    let allCategories = [];
    let currentCategoryFilter = null; // null = show all, categoryId = filter by category

    // Helper function to fix text encoding
    function fixTextEncoding(text) {
      if (typeof text !== 'string') return text;

      try {
        // Try multiple decoding approaches
        return decodeURIComponent(escape(text));
      } catch (e) {
        try {
          // Fallback: replace common corrupted characters
          return text.replace(/â‚¬Ã¢Ã¢Ã¢Ã/g, '');
        } catch (e2) {
          return text;
        }
      }
    }

    // Function to delete a category
    async function deleteCategory(categoryId) {
      try {
        // Get current categories
        const result = await chrome.storage.sync.get('PinGPTChat-categories');
        const categories = result['PinGPTChat-categories'] || [];

        // Find the category name for notification (fix encoding)
        const categoryToDelete = categories.find(cat => cat.id === categoryId);
        const safeCategoryName = fixTextEncoding(categoryToDelete?.name || 'Unknown');

        // Remove the category
        const updatedCategories = categories.filter(cat => cat.id !== categoryId);

        // Save updated categories
        await chrome.storage.sync.set({ 'PinGPTChat-categories': updatedCategories });

        // Get chat-category associations
        const chatResult = await chrome.storage.sync.get('PinGPTChat-chat-categories');
        const chatCategories = chatResult['PinGPTChat-chat-categories'] || {};

        // Remove category from all chats
        Object.keys(chatCategories).forEach(chatId => {
          chatCategories[chatId] = chatCategories[chatId].filter(catId => catId !== categoryId);

          // Remove chat entry if no categories left
          if (chatCategories[chatId].length === 0) {
            delete chatCategories[chatId];
          }
        });

        // Save updated chat-category associations
        await chrome.storage.sync.set({ 'PinGPTChat-chat-categories': chatCategories });

        // Refresh category filter buttons
        await loadCategoryFilters();

        // Refresh the chat display
        displayChats(allChats);

        showNotification(`Deleted category: "${safeCategoryName}"`);
      } catch (error) {
        console.error("Error deleting category:", error);
        showNotification("Error deleting category. Please try again.");
      }
    }


    // Category management functions
    async function loadCategories() {
      try {
        const result = await chrome.storage.sync.get('PinGPTChat-categories');
        const categories = result['PinGPTChat-categories'] || [];

        // Ensure "Important" category exists
        const importantExists = categories.some(cat => cat.name === "Important");
        if (!importantExists) {
          categories.unshift({ id: "important", name: "Important", isDefault: true });
          await chrome.storage.sync.set({ 'PinGPTChat-categories': categories });
        }

        allCategories = categories;
        return categories;
      } catch (error) {
        console.error("Error loading categories:", error);
        return [];
      }
    }

    async function showCategoryModal(chat) {
      currentChatForCategory = chat;

      try {
        const categories = await loadCategories();
        categoryList.innerHTML = "";

        categories.forEach(category => {
          const categoryItem = document.createElement("div");
          categoryItem.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px;
            margin-bottom: 8px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s;
          `;

          categoryItem.innerHTML = `
            <span>${category.name}</span>
            <button class="add-to-category-btn" data-category-id="${category.id}" style="
              background: #1e88e5;
              color: white;
              border: none;
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            ">Add</button>
          `;

          categoryItem.onmouseover = () => {
            categoryItem.style.backgroundColor = '#f5f5f5';
          };
          categoryItem.onmouseout = () => {
            categoryItem.style.backgroundColor = 'white';
          };

          categoryList.appendChild(categoryItem);

          // Add event listener to the button
          const addBtn = categoryItem.querySelector('.add-to-category-btn');
          addBtn.onclick = async (e) => {
            e.stopPropagation();
            await addChatToCategory(chat.id, category.id);
            categoryModal.style.display = "none";
            showNotification(`Added "${chat.name}" to "${category.name}"`);
          };
        });

        categoryModal.style.display = "block";
      } catch (error) {
        console.error("Error showing category modal:", error);
      }
    }

    async function addChatToCategory(chatId, categoryId) {
      try {
        const result = await chrome.storage.sync.get('PinGPTChat-chat-categories');
        const chatCategories = result['PinGPTChat-chat-categories'] || {};

        if (!chatCategories[chatId]) {
          chatCategories[chatId] = [];
        }
        if (!chatCategories[chatId].includes(categoryId)) {
          chatCategories[chatId].push(categoryId);
        }

        await chrome.storage.sync.set({ 'PinGPTChat-chat-categories': chatCategories });

        // Refresh category filter buttons to show any new categories
        await loadCategoryFilters();
      } catch (error) {
        console.error("Error adding chat to category:", error);
      }
    }

    function showNotification(message) {
      // Simple notification system
      const notification = document.createElement("div");
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 1001;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;

      document.body.appendChild(notification);

      setTimeout(() => {
        notification.remove();
      }, 3000);
    }

    // Modal event listeners
    closeCategoryModal.onclick = () => {
      categoryModal.style.display = "none";
    };

    window.onclick = (event) => {
      if (event.target === categoryModal) {
        categoryModal.style.display = "none";
      }
    };

    createCategoryBtn.onclick = async () => {
      const categoryName = newCategoryInput.value.trim();
      if (categoryName && currentChatForCategory) {
        try {
          const categories = await loadCategories();
          const newCategory = {
            id: `category_${Date.now()}`,
            name: categoryName,
            isDefault: false
          };
          categories.push(newCategory);
          await chrome.storage.sync.set({ 'PinGPTChat-categories': categories });

          // Add chat to new category
          await addChatToCategory(currentChatForCategory.id, newCategory.id);

          // Refresh category filter buttons
          await loadCategoryFilters();

          categoryModal.style.display = "none";
          newCategoryInput.value = "";
          showNotification(`Created "${categoryName}" and added "${currentChatForCategory.name}"`);
        } catch (error) {
          console.error("Error creating category:", error);
        }
      }
    };

    // Load category filter buttons
    async function loadCategoryFilters() {
      try {
        const categories = await loadCategories();
        const categoryFilter = document.getElementById("categoryFilter");

        if (!categoryFilter) {
          console.error("Category filter container not found!");
          return;
        }

        // Clear existing category buttons
        categoryFilter.innerHTML = "";

        console.log("Creating filter buttons for categories:", categories);

        categories.forEach(category => {
           const categoryBtn = document.createElement("button");
           categoryBtn.className = "category-filter-btn";
           categoryBtn.textContent = decodeURIComponent(escape(category.name));
           categoryBtn.dataset.categoryId = category.id;

           categoryBtn.onclick = () => {
             setActiveCategory(category.id);
             filterChatsByCategory(category.id);
           };

           categoryFilter.appendChild(categoryBtn);
           console.log(`Created button for category: ${category.name} (${category.id})`);
         });

         console.log(`Total category buttons created: ${categories.length}`);
      } catch (error) {
        console.error("Error loading category filters:", error);
      }
    }

    // Set active category button
    function setActiveCategory(categoryId) {
      // Remove active class from all buttons
      document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });

      // Add active class to selected button
      if (categoryId === null) {
        allCategoriesBtn.classList.add('active');
      } else {
        const activeBtn = document.querySelector(`[data-category-id="${categoryId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
      }

      currentCategoryFilter = categoryId;
    }

    // Filter chats by category
    async function filterChatsByCategory(categoryId) {
      try {
        let chatsToShow = [];

        if (categoryId === null) {
          // Show all chats
          chatsToShow = allChats;
        } else {
          // Get result from storage
          const result = await chrome.storage.sync.get('PinGPTChat-chat-categories');
          const chatCategories = result['PinGPTChat-chat-categories'] || {};

          const chatIds = Object.keys(chatCategories)
            .filter(chatId => chatCategories[chatId].includes(categoryId));

          chatsToShow = allChats.filter(chat => chatIds.includes(chat.id));
        }

        // Apply current search term if any
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
          chatsToShow = chatsToShow.filter(chat =>
            chat.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        displayChats(chatsToShow);
      } catch (error) {
        console.error("Error filtering chats by category:", error);
      }
    }

    // Display chats with category badges
    function displayChats(chats) {
      // Clear existing chats
      pinnedChatsDiv.innerHTML = "";
      emptyStateDiv.style.display = "none";

      if (chats.length === 0) {
        const noResultsDiv = document.createElement("div");
        noResultsDiv.style.textAlign = "center";
        noResultsDiv.style.padding = "40px 20px";
        noResultsDiv.style.color = "#666";

        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
          noResultsDiv.innerHTML = `
            <h3 style="margin-bottom: 10px;">No chats found</h3>
            <p>No chats match "${searchTerm}" in current category</p>
          `;
        } else {
          noResultsDiv.innerHTML = `
            <h3 style="margin-bottom: 10px;">No chats in this category</h3>
            <p>Add some chats to this category first</p>
          `;
        }
        pinnedChatsDiv.appendChild(noResultsDiv);
        return;
      }

      // Show filtered chats
      chats.forEach((chat) => {
      const chatCard = document.createElement("div");
      chatCard.className = "chat-card-horizontal";

      const chatInfo = document.createElement("div");
      chatInfo.className = "chat-info";

      const chatName = document.createElement("div");
      chatName.className = "chat-title";
      chatName.textContent = chat.name;
      chatName.onclick = () => {
        // Open chat in new tab
        window.open(`https://chat.openai.com/c/${chat.id}`, '_blank');
      };

      chatInfo.appendChild(chatName);

      const chatActions = document.createElement("div");
      chatActions.className = "chat-actions-inline";

      const openBtn = document.createElement("a");
      openBtn.className = "btn btn-primary";
      openBtn.href = `https://chat.openai.com/c/${chat.id}`;
      openBtn.target = "_blank";
      openBtn.textContent = "Open";
      openBtn.style.marginRight = "8px";

      const copyBtn = document.createElement("button");
      copyBtn.className = "btn btn-secondary";
      copyBtn.textContent = "Copy";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(`https://chat.openai.com/c/${chat.id}`).then(() => {
          // Show brief feedback
          const originalText = copyBtn.textContent;
          copyBtn.textContent = "Copied!";
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 1000);
        });
      };

      const addToCategoryBtn = document.createElement("button");
      addToCategoryBtn.className = "btn btn-secondary";
      addToCategoryBtn.textContent = "+ Add";
      addToCategoryBtn.style.marginLeft = "4px";
      addToCategoryBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showCategoryModal(chat);
      };

      chatActions.appendChild(openBtn);
      chatActions.appendChild(copyBtn);
      chatActions.appendChild(addToCategoryBtn);

      chatCard.appendChild(chatInfo);
      chatCard.appendChild(chatActions);

       pinnedChatsDiv.appendChild(chatCard);
     });
   }

   // Hide loading spinner
   loadingDiv.style.display = "none";

   if (pinnedChats.length === 0) {
     emptyStateDiv.style.display = "block";
     console.log("PinGPTChat: No pinned chats found");
     return;
   }

   console.log(`PinGPTChat: Loading ${pinnedChats.length} pinned chats in full page view`);

   // Store all chats for search functionality
   allChats = [...pinnedChats];

   // Load category filter buttons
   await loadCategoryFilters();

   // Debug: Log loaded categories
   console.log("Loaded categories for filters:", allCategories);

   // Show pinned chats
   pinnedChatsDiv.style.display = "block";
   setActiveCategory(null); // Set "All Chats" as active initially
   displayChats(allChats); // Show all chats initially

   // Add search event listeners
   searchInput.addEventListener("input", (e) => {
     const searchTerm = e.target.value.trim();
     // Apply search within current category filter
     if (currentCategoryFilter === null) {
       // Filter all chats
       const filteredChats = searchTerm
         ? allChats.filter(chat => chat.name.toLowerCase().includes(searchTerm.toLowerCase()))
         : allChats;
       displayChats(filteredChats);
     } else {
       // Filter within category
       filterChatsByCategory(currentCategoryFilter);
     }
   });

   // Function to show new category modal
   function showNewCategoryModal() {
     newCategoryModal.style.display = "block";
     inlineCategoryInput.focus();
     inlineCategoryInput.value = "";
   }

   // Function to hide new category modal
   function hideNewCategoryModal() {
     newCategoryModal.style.display = "none";
     inlineCategoryInput.value = "";
   }

   // Function to show manage categories modal
   async function showManageCategoriesModal() {
     console.log("Opening manage categories modal...");
     try {
       if (!manageCategoriesModal) {
         console.error("Manage categories modal not found!");
         return;
       }

       // Force display style to block
       manageCategoriesModal.style.display = "block";
       manageCategoriesModal.style.position = "fixed";
       manageCategoriesModal.style.zIndex = "1002";

       if (manageCategoryInput) {
         manageCategoryInput.focus();
         manageCategoryInput.value = "";
       }
       if (searchCategoriesInput) {
         searchCategoriesInput.value = "";
       }

       // Load and display categories
       await displayCategoriesInModal();
       console.log("Manage categories modal opened successfully");
     } catch (error) {
       console.error("Error opening manage categories modal:", error);
     }
   }

   // Function to hide manage categories modal
   function hideManageCategoriesModal() {
     console.log("Hiding manage categories modal");
     if (manageCategoriesModal) {
       manageCategoriesModal.style.display = "none";
     }
     if (manageCategoryInput) {
       manageCategoryInput.value = "";
     }
     if (searchCategoriesInput) {
       searchCategoriesInput.value = "";
     }
   }

   // Function to display categories in modal
   async function displayCategoriesInModal(searchTerm = "") {
     try {
       const categories = await loadCategories();

       // Filter categories based on search term
       const filteredCategories = searchTerm
         ? categories.filter(cat => fixTextEncoding(cat.name).toLowerCase().includes(searchTerm.toLowerCase()))
         : categories;

       categoriesList.innerHTML = "";

       if (filteredCategories.length === 0) {
         categoriesList.innerHTML = `
           <div style="text-align: center; padding: 40px 20px; color: #666;">
             <p>No categories found</p>
           </div>
         `;
         return;
       }

       filteredCategories.forEach(category => {
         const safeName = fixTextEncoding(category.name);

         const categoryItem = document.createElement("div");
         categoryItem.style.cssText = `
           display: flex;
           align-items: center;
           justify-content: space-between;
           padding: 12px 15px;
           margin-bottom: 8px;
           border: 1px solid #e0e0e0;
           border-radius: 6px;
           background: white;
           transition: background-color 0.2s;
         `;

         categoryItem.innerHTML = `
           <span style="flex: 1; font-size: 14px;">${safeName}</span>
           <button class="delete-category-btn" data-category-id="${category.id}" style="
             background: #dc3545;
             color: white;
             border: none;
             padding: 6px 12px;
             border-radius: 4px;
             cursor: pointer;
             font-size: 12px;
             margin-left: 10px;
             transition: background-color 0.2s;
           ">Delete</button>
         `;

         categoryItem.onmouseover = () => {
           categoryItem.style.backgroundColor = '#f8f9fa';
         };
         categoryItem.onmouseout = () => {
           categoryItem.style.backgroundColor = 'white';
         };

         categoriesList.appendChild(categoryItem);

         // Add delete event listener
         const deleteBtn = categoryItem.querySelector('.delete-category-btn');
         deleteBtn.onclick = async (e) => {
           e.stopPropagation();
           const categoryName = safeName;
           if (confirm(`Are you sure you want to delete the "${categoryName}" category?`)) {
             await deleteCategory(category.id);
             // Refresh the modal display
             await displayCategoriesInModal(searchCategoriesInput.value);
           }
         };
       });
     } catch (error) {
       console.error("Error displaying categories in modal:", error);
       categoriesList.innerHTML = `
         <div style="text-align: center; padding: 40px 20px; color: red;">
           <p>Error loading categories</p>
         </div>
       `;
     }
   }

   // Function to create category from manage modal
   async function createCategoryFromManage() {
     const categoryName = manageCategoryInput.value.trim();
     if (categoryName) {
       try {
         const safeCategoryName = fixTextEncoding(categoryName);

         const categories = await loadCategories();
         const newCategory = {
           id: `category_${Date.now()}`,
           name: safeCategoryName,
           isDefault: false
         };
         categories.push(newCategory);
         await chrome.storage.sync.set({ 'PinGPTChat-categories': categories });

         // Refresh category filter buttons
         await loadCategoryFilters();

         // Refresh modal display
         await displayCategoriesInModal(searchCategoriesInput.value);

         manageCategoryInput.value = "";
         showNotification(`Created new category: "${safeCategoryName}"`);
       } catch (error) {
         console.error("Error creating category from manage modal:", error);
         showNotification("Error creating category. Please try again.");
       }
     }
   }

   // Category filter event listeners
   allCategoriesBtn.onclick = () => {
     setActiveCategory(null);
     displayChats(allChats);
     searchInput.value = ""; // Clear search when switching categories
   };

   // Manage categories modal event listeners
   if (manageCategoriesBtn) {
     manageCategoriesBtn.onclick = function() {
       console.log("Manage button clicked!");
       showManageCategoriesModal();
     };
     console.log("Manage categories button event listener attached");
   } else {
     console.error("Manage categories button not found!");
   }

   closeManageModal.onclick = hideManageCategoriesModal;

   createFromManageBtn.onclick = createCategoryFromManage;

   // Handle Enter key in manage input field
   manageCategoryInput.addEventListener("keypress", (e) => {
     if (e.key === "Enter") {
       e.preventDefault();
       createCategoryFromManage();
     }
   });

   // Handle Escape key to close manage modal
   manageCategoryInput.addEventListener("keydown", (e) => {
     if (e.key === "Escape") {
       hideManageCategoriesModal();
     }
   });

   // Search categories in modal
   searchCategoriesInput.addEventListener("input", (e) => {
     const searchTerm = e.target.value.trim();
     displayCategoriesInModal(searchTerm);
   });

   // Close manage modal when clicking outside
   if (manageCategoriesModal) {
     manageCategoriesModal.onclick = (event) => {
       if (event.target === manageCategoriesModal) {
         console.log("Closing manage modal via outside click");
         hideManageCategoriesModal();
       }
     };
   }

   // Close modal when clicking outside
   document.addEventListener('click', (event) => {
     if (!event.target.closest('.category-modal') && !event.target.closest('.modal')) {
       document.querySelectorAll('.category-modal').forEach(modal => {
         modal.style.display = 'none';
       });
     }
   });

   // Search on Enter key
   searchInput.addEventListener("keypress", (e) => {
     if (e.key === "Enter") {
       e.preventDefault();
       searchInput.dispatchEvent(new Event('input')); // Trigger search
     }
   });

 } catch (error) {
    console.error("PinGPTChat: Error loading pinned chats in full page:", error);
    document.getElementById("loading").style.display = "none";
    document.getElementById("pinned-chats").innerHTML =
      '<div style="padding: 20px; color: red; text-align: center;">Error loading pinned chats.</div>';
  }
});