(function () {
  var composer = document.getElementById('composer');
  var sendBtn = document.getElementById('send-btn');
  var messagesList = document.getElementById('messages-list');
  var emptyState = document.getElementById('empty-state');
  var thinkingState = document.getElementById('thinking-state');
  var conversationList = document.getElementById('conversation-list');
  var fileInput = document.getElementById('file-input');
  var attachBtn = document.getElementById('attach-btn');
  var imageBtn = document.getElementById('image-btn');
  var fileChips = document.getElementById('file-chips');
  var newChatSidebar = document.getElementById('new-chat-sidebar');

  var currentConversationId = null;
  var pendingFiles = [];

  function showChat() {
    emptyState.classList.add('hidden');
    messagesList.classList.remove('hidden');
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderMarkdown(text) {
    var html = escapeHtml(text);
    html = html
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="font-mono-code text-mono-code bg-black/30 px-1.5 py-0.5 rounded text-primary-fixed-dim">$1</code>')
      .replace(/```([\s\S]*?)```/g, function (_, code) {
        return '<pre class="p-4 overflow-x-auto bg-surface-container/30 backdrop-blur-md rounded-xl border border-white/10 my-4"><code class="font-mono-code text-mono-code text-on-surface">' + code.replace(/^\n/, '') + '</code></pre>';
      })
      .replace(/^### (.*$)/gim, '<h3 class="font-headline-md text-headline-md text-primary mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="font-headline-md text-headline-md text-primary mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="font-display-lg text-display-lg text-primary mt-6 mb-3">$1</h1>')
      .replace(/\n/g, '<br>');
    return html;
  }

  function addMessage(role, content, animate) {
    var div = document.createElement('div');
    div.className = role === 'user' ? 'flex justify-end w-full group' : 'flex justify-start w-full gap-4 group';
    var bubbleClass = role === 'user'
      ? 'bg-surface-container-high border border-white/5 rounded-2xl rounded-tr-sm px-5 py-4 max-w-[85%] md:max-w-[75%] shadow-sm'
      : 'bg-[#1A2235] bg-opacity-60 backdrop-blur-xl border-l-2 border-l-primary border-t border-r border-b border-white/5 rounded-2xl rounded-tl-sm px-6 py-6 max-w-[95%] md:max-w-[85%] shadow-lg';

    if (role === 'assistant') {
      div.innerHTML =
        '<div class="w-8 h-8 rounded-full bg-surface-container-highest border border-primary/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(189,194,255,0.1)] relative">' +
        '<span class="material-symbols-outlined text-primary text-[18px]" style="font-variation-settings: \'FILL\' 1;">robot_2</span>' +
        '</div>' +
        '<div class="' + bubbleClass + (animate ? ' animate-stream' : '') + '">' +
        '<div class="prose prose-invert max-w-none text-on-surface font-body-md text-body-md">' + renderMarkdown(content) + '</div>' +
        '</div>';
    } else {
      div.innerHTML = '<div class="' + bubbleClass + '"><p class="font-body-md text-body-md text-on-surface">' + escapeHtml(content) + '</p></div>';
    }
    messagesList.appendChild(div);
    scrollToBottom();
  }

  function scrollToBottom() {
    var scroller = document.getElementById('chat-scroll');
    scroller.scrollTop = scroller.scrollHeight;
  }

  function loadConversations() {
    getConversations().then(function (res) {
      var data = res.data || [];
      conversationList.innerHTML = '';
      data.forEach(function (conv) {
        var a = document.createElement('a');
        a.href = '#';
        a.className = 'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ease-in-out ' +
          (conv.id === currentConversationId ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:bg-surface-bright/50 hover:scale-[1.02]');
        a.innerHTML = '<span class="material-symbols-outlined text-[18px]">chat_bubble</span><span class="truncate">' + escapeHtml(conv.title || 'New Chat') + '</span>';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          loadConversation(conv.id);
        });
        conversationList.appendChild(a);
      });
    }).catch(function (err) {
      console.error('Failed to load conversations', err);
    });
  }

  function loadConversation(id) {
    currentConversationId = id;
    getConversation(id).then(function (conv) {
      emptyState.classList.add('hidden');
      messagesList.classList.remove('hidden');
      messagesList.innerHTML = '';
      conv.messages.forEach(function (m) { addMessage(m.role, m.content); });
      loadConversations();
    }).catch(function (err) {
      console.error(err);
    });
  }

  function startNewChat() {
    currentConversationId = null;
    messagesList.innerHTML = '';
    messagesList.classList.add('hidden');
    emptyState.classList.remove('hidden');
    composer.value = '';
    pendingFiles = [];
    renderFileChips();
    loadConversations();
  }

  function readStream(reader, onChunk, onDone, onError) {
    var decoder = new TextDecoder();
    var buffer = '';

    function pump() {
      reader.read().then(function (result) {
        if (result.done) {
          onDone();
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.indexOf('data:') !== 0) continue;
          var json = line.slice(5).trim();
          if (json === '[DONE]') {
            onDone();
            return;
          }
          try {
            onChunk(JSON.parse(json));
          } catch (e) {
            // ignore
          }
        }
        pump();
      }).catch(function (err) {
        onError(err);
      });
    }
    pump();
  }

  function setThinkingLabel(label) {
    var span = thinkingState.querySelector('span');
    if (span) span.textContent = label;
  }

  function sendMessage() {
    var text = composer.value.trim();
    if (!text && pendingFiles.length === 0) return;

    showChat();
    composer.value = '';
    composer.style.height = 'auto';
    sendBtn.disabled = true;

    thinkingState.classList.remove('hidden');
    thinkingState.classList.add('flex');
    setThinkingLabel('Uploading...');

    var attachmentIds = [];
    var attachmentNames = [];
    var uploadPromises = pendingFiles.map(function (file) {
      return uploadFile(file, currentConversationId).then(function (att) {
        attachmentIds.push(att.id);
        attachmentNames.push(att.originalName);
      }).catch(function (err) {
        console.error('Upload failed', err);
      });
    });

    Promise.all(uploadPromises).then(function () {
      pendingFiles = [];
      renderFileChips();

      var displayText = text
        ? attachmentNames.length
          ? text + ' ' + attachmentNames.map(function (n) { return '[' + n + ']'; }).join(' ')
          : text
        : attachmentNames.map(function (n) { return '[' + n + ']'; }).join(' ');
      addMessage('user', displayText);

      setThinkingLabel('Reasoning...');

      var aiBubble = document.createElement('div');
      aiBubble.className = 'flex justify-start w-full gap-4 group';
      aiBubble.innerHTML =
        '<div class="w-8 h-8 rounded-full bg-surface-container-highest border border-primary/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(189,194,255,0.1)] relative">' +
        '<span class="material-symbols-outlined text-primary text-[18px]" style="font-variation-settings: \'FILL\' 1;">robot_2</span>' +
        '</div>' +
        '<div class="bg-[#1A2235] bg-opacity-60 backdrop-blur-xl border-l-2 border-l-primary border-t border-r border-b border-white/5 rounded-2xl rounded-tl-sm px-6 py-6 max-w-[95%] md:max-w-[85%] shadow-lg animate-stream">' +
        '<div class="prose prose-invert max-w-none text-on-surface font-body-md text-body-md" id="streaming-content"></div>' +
        '</div>';
      messagesList.appendChild(aiBubble);
      scrollToBottom();
      var streamingContent = aiBubble.querySelector('#streaming-content');

      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        thinkingState.classList.add('hidden');
        thinkingState.classList.remove('flex');
        sendBtn.disabled = false;
        composer.focus();
      }

      var timeoutId = setTimeout(function () {
        streamingContent.innerHTML += '<p class="text-error mt-2">Response timed out. Please try again.</p>';
        finish();
      }, 60000);

      fetch(API_BASE + '/stream', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ conversationId: currentConversationId, message: text, attachments: attachmentIds })
      }).then(function (res) {
        if (res.status === 401) {
          clearTimeout(timeoutId);
          clearToken();
          window.location.href = '/login.html';
          return;
        }
        var reader = res.body.getReader();
        var fullText = '';
        var firstToken = true;
        readStream(reader, function (chunk) {
          if (chunk.type === 'token') {
            if (firstToken) {
              firstToken = false;
              thinkingState.classList.add('hidden');
              thinkingState.classList.remove('flex');
            }
            fullText += chunk.data;
            streamingContent.innerHTML = renderMarkdown(fullText);
            scrollToBottom();
          } else if (chunk.type === 'done') {
            currentConversationId = chunk.conversationId;
            loadConversations();
          } else if (chunk.type === 'error') {
            streamingContent.innerHTML += '<p class="text-error mt-2">' + escapeHtml(chunk.error || 'Error') + '</p>';
          }
        }, function () {
          clearTimeout(timeoutId);
          finish();
        }, function (err) {
          clearTimeout(timeoutId);
          streamingContent.innerHTML += '<p class="text-error mt-2">' + escapeHtml(err.message || 'Failed to get response') + '</p>';
          finish();
        });
      }).catch(function (err) {
        clearTimeout(timeoutId);
        streamingContent.innerHTML += '<p class="text-error mt-2">' + escapeHtml(err.message || 'Failed to get response') + '</p>';
        finish();
      });
    });
  }

  function renderFileChips() {
    fileChips.innerHTML = '';
    pendingFiles.forEach(function (file, idx) {
      var chip = document.createElement('div');
      chip.className = 'px-2 py-1 rounded-full bg-surface-container border border-white/5 text-xs text-on-surface-variant flex items-center gap-1';
      chip.innerHTML = '<span class="truncate max-w-[120px]">' + escapeHtml(file.name) + '</span><button class="hover:text-error" data-idx="' + idx + '">&times;</button>';
      chip.querySelector('button').addEventListener('click', function () {
        pendingFiles.splice(idx, 1);
        renderFileChips();
      });
      fileChips.appendChild(chip);
    });
  }

  function handleFileSelect(type) {
    fileInput.accept = type === 'image' ? 'image/*' : '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.docx,.csv,.json,.md';
    fileInput.click();
  }

  fileInput.addEventListener('change', function () {
    for (var i = 0; i < fileInput.files.length; i++) pendingFiles.push(fileInput.files[i]);
    fileInput.value = '';
    renderFileChips();
  });

  attachBtn.addEventListener('click', function () { handleFileSelect('file'); });
  imageBtn.addEventListener('click', function () { handleFileSelect('image'); });
  sendBtn.addEventListener('click', sendMessage);
  composer.addEventListener('input', function () { composer.style.height = 'auto'; composer.style.height = composer.scrollHeight + 'px'; });
  composer.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  newChatSidebar.addEventListener('click', startNewChat);

  document.querySelectorAll('.suggestion-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      composer.value = btn.dataset.prompt;
      sendMessage();
    });
  });

  document.getElementById('logout-btn').addEventListener('click', function (e) { e.preventDefault(); logout(); });

  loadConversations();

  var params = new URLSearchParams(window.location.search);
  if (params.get('conversation')) {
    loadConversation(params.get('conversation'));
  }
})();
