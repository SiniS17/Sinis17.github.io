// Modern Quiz Application - Enhanced JavaScript
// Global variables
let SelectedfileName = '';
let GlobalselectedCount = 20;
let pendingQuestionCount = 20; // Store pending question count until Enter or Try Again
let liveTestCheckbox;
let levelCounts = {};
window.answeredQuestions = [];

// Store current quiz state for try again functionality
let currentQuizState = {
  fileName: '',
  questionCount: 20,
  selectedLevels: [],
  isLiveMode: false,
  allQuestions: []
};

// Utility functions
// Legacy loading functions - now use unified loading screen system
const showLoading = (message = 'Loading...', subtitle = 'Please wait') => {
  showLoadingScreen(message, subtitle);
};

const hideLoading = () => {
  hideLoadingScreen();
};

const addFadeInAnimation = (element) => {
  // Enhanced jQuery fade-in animation
  if (window.jQuery) {
    $(element).hide().fadeIn(400).css('opacity', '1');
  } else {
    element.classList.add('fade-in');
    setTimeout(() => element.classList.remove('fade-in'), 300);
  }
};

const showNotification = (message, type = 'info') => {
  if (window.jQuery) {
    // Enhanced jQuery notification with better animations
    const $notification = $('<div>')
      .addClass(`notification ${type}`)
      .css({
        position: 'fixed',
        top: '20px',
        right: '-300px', // Start off-screen
        padding: '1rem 1.5rem',
        background: type === 'error' ? 'var(--error-color)' : type === 'success' ? 'var(--success-color)' : 'var(--primary-color)',
        color: 'white',
        borderRadius: 'var(--border-radius)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1000,
        minWidth: '250px'
      })
      .text(message)
      .appendTo('body')
      .animate({ right: '20px' }, 300); // Slide in from right
    
    // Auto-remove with slide-out animation
    setTimeout(() => {
      $notification.animate({ right: '-300px' }, 300, function() {
        $(this).remove();
      });
    }, 3000);
    return;
  }
  
  // Fallback vanilla JavaScript
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    background: ${type === 'error' ? 'var(--error-color)' : type === 'success' ? 'var(--success-color)' : 'var(--primary-color)'};
    color: white;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.style.transform = 'translateX(0)', 100);
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
};

// Initialize application with jQuery
$(document).ready(function() {
  initializeApp();
  initializeJQueryEnhancements();
  initFloatingControls();
});

function initializeApp() {
  listQuizzes();
  setupEventListeners();
}

// jQuery enhancements for better interactions
function initializeJQueryEnhancements() {
  if (!window.jQuery) return;
  
  // Enhanced hover effects for quiz boxes (using CSS transitions)
  $(document).on('mouseenter', '.quiz-box', function() {
    $(this).addClass('hovered');
  });
  
  $(document).on('mouseleave', '.quiz-box', function() {
    $(this).removeClass('hovered');
  });
  
  // Smooth scroll to questions
  $(document).on('click', '.sidebar-question-link', function(e) {
    e.preventDefault();
    const targetId = $(this).attr('href');
    $('html, body').animate({
      scrollTop: $(targetId).offset().top - 100
    }, 500);
  });
  
  // Enhanced loading overlay
  // Unified loading system for AJAX requests
  $(document).on('ajaxStart', function() {
    showLoadingScreen('Loading...', 'Please wait while data is being fetched...');
  });
  
  $(document).on('ajaxComplete', function() {
    hideLoadingScreen();
  });
  
  // Smooth transitions for top controls - removed conflicting live test click handler
  // Live test functionality is now handled by the dedicated change event listener
  
  // Enhanced answer selection with jQuery
  $(document).on('click', '.answer', function() {
    const $this = $(this);
    const $question = $this.closest('.question');
    const $radio = $this.find('input[type="radio"]');
    
    // Remove previous selections with animation
    $question.find('.answer.selected').removeClass('selected');
    
    // Add new selection with animation
    $this.addClass('selected');
    
    // Check the radio button
    $radio.prop('checked', true);
    
    // Get question index and update status using canonical function
    const questionIndex = parseInt($question.attr('id').replace('question-', ''));
    if (!isNaN(questionIndex)) {
      // Use the canonical updateAnswerStatus function
      updateAnswerStatus(questionIndex);
      
      // Update live test score if in live mode
      if (liveTestCheckbox && liveTestCheckbox.checked) {
        updateLiveScore();
        highlightLiveAnswers($question[0]);
      }
    }
  });
  
  // Smooth sidebar transitions  
  $(document).on('click', '.sidebar-toggle', function() {
    $('#left-sidebar').toggleClass('expanded').slideToggle(300);
  });
  
  console.log('✅ jQuery enhancements initialized');
}


function setupEventListeners() {
  // Global keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const resultsContainer = document.getElementById('results-container');
      if (resultsContainer && resultsContainer.style.display === 'block') {
        resultsContainer.style.display = 'none';
      }
    }
  });
}

// Quiz listing and navigation
function listQuizzes(folder = '') {
  if (folder && folder.target) {
    folder = '';
  }

  showLoading();
  disableAllControlsDuringLoad();
  levelCounts = {};
  
  // Reset UI elements
  updateQuizTitle('Aviation Quiz');
  clearQuizContainer();

  hideTopControls();
  showQuizSelection();

  const quizGrid = document.getElementById('quiz-grid');
  if (!quizGrid) {
    console.error('Quiz grid container not found');
    enableAllControlsAfterLoad();
    hideLoading();
    return;
  }
  
  quizGrid.innerHTML = '';

  // Add back button if in a folder
  if (folder) {
    const backButton = document.createElement('div');
    backButton.className = 'quiz-box back-button';
    backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Categories';
    backButton.onclick = () => listQuizzes('');
    quizGrid.appendChild(backButton);
    addFadeInAnimation(backButton);
  }

  // Fetch quiz data
  fetch('/api/list-quizzes' + (folder ? `?folder=${encodeURIComponent(folder)}` : ''))
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.folders.length === 0 && data.files.length === 0) {
        quizGrid.innerHTML = '<div class="no-content">No quizzes or folders found.</div>';
        enableAllControlsAfterLoad();
        hideLoading();
        return;
      }

      // Sort folders and files alphabetically (case-insensitive)
      data.folders.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      data.files.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

      // Create all folders immediately
      data.folders.forEach((folderName) => {
        const folderBox = createFolderBox(folderName);
        quizGrid.appendChild(folderBox);
        addFadeInAnimation(folderBox);
      });

      // Create all quiz files immediately
      data.files.forEach((file) => {
        const quizBox = createQuizBox(file, folder);
        quizGrid.appendChild(quizBox);
        addFadeInAnimation(quizBox);
      });
      
      // Re-enable controls and hide loading after everything is added
      enableAllControlsAfterLoad();
      hideLoading();
    })
    .catch(error => {
      enableAllControlsAfterLoad();
      hideLoading();
      console.error('Error fetching quiz list:', error);
      showNotification('Error loading quizzes. Please try again.', 'error');
      quizGrid.innerHTML = '<div class="error-message">Error loading quizzes. Please refresh the page.</div>';
    });
}

function createFolderBox(folderName) {
  const folderBox = document.createElement('div');
  folderBox.className = 'quiz-box folder-select';
  folderBox.innerHTML = `
    <i class="fas fa-folder"></i>
    <h3>${folderName}</h3>
    <p>Browse quiz categories</p>
  `;
  
  folderBox.onclick = () => {
    showLoadingScreen('Opening Folder', `Loading quizzes from ${folderName}...`);
    setTimeout(() => {
      listQuizzes(folderName);
    }, 100);
  };
  
  return folderBox;
}

function createQuizBox(file, folder) {
  const quizBox = document.createElement('div');
  quizBox.className = 'quiz-box';
  quizBox.innerHTML = `
    <i class="fas fa-file-text"></i>
    <h3>${file.replace('.txt', '').replace(' (-)', '')}</h3>
    <p>Click to start quiz</p>
  `;
  
  quizBox.onclick = () => {
    const filePath = folder ? `${folder}/${file}` : file;
    initializeQuiz(filePath);
  };
  
  return quizBox;
}

// Quiz initialization and loading
function initializeQuiz(fileName) {
  showLoading();
  disableAllControlsDuringLoad();
  SelectedfileName = fileName;
  
  hideQuizSelection();
  showQuizSettings();
  
  // Load quiz immediately without delay
  loadQuiz(fileName);
}

function loadQuiz(fileName) {
  updateQuizTitle(fileName.replace('.txt', '').replace(' (-)', ''));
  clearQuizContainer();

  // Note: showLoading already called in initializeQuiz

  fetch('./list quizzes/' + fileName)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(text => {
      // Don't hide loading here - let displayQuestions handle it
      processQuizDataAndStart(text, fileName);
      showNotification('Quiz loaded successfully!', 'success');
    })
    .catch(error => {
      enableAllControlsAfterLoad();
      hideLoading();
      console.error('Error loading quiz:', error);
      showNotification('Error loading quiz. Please try again.', 'error');
    });
}

function processQuizDataAndStart(text, fileName) {
  // Reset level counts and checkboxes
  levelCounts = {};
  clearLevelCheckboxes();

  // For files with (-), keep blank lines as separators; otherwise filter them out
  const hasVariableAnswers = fileName.includes('(-)');
  const lines = hasVariableAnswers 
    ? text.split('\n')
    : text.split('\n').filter(line => line.trim() !== '');
  const questions = parseQuestions(lines, fileName);
  
  // Show top controls and populate them
  showTopControls();
  updateQuizInfo(questions.length);
  createTopLevelCheckboxes();
  setupTopQuestionCountInput(questions);
  
  // Hide quiz list and start quiz immediately
  hideQuizList();
  displayQuestions(questions);
}

function showTopControls() {
  const leftSidebar = document.getElementById('left-sidebar');
  const mainContent = document.querySelector('.main-content');
  const quizInterface = document.querySelector('.quiz-interface');
  const controlFab = document.getElementById('control-fab');
  const sidebarFab = document.getElementById('sidebar-fab');
  
  // Show control FAB (always visible when quiz is active)
  if (controlFab) {
    controlFab.classList.add('active');
  }
  
  // Show sidebar FAB (will only display on mobile due to .mobile-only class)
  if (sidebarFab) {
    sidebarFab.classList.add('active');
  }
  
  // Show sidebar on desktop
  if (leftSidebar) {
    leftSidebar.style.display = 'block';
  }
  
  if (mainContent) {
    mainContent.classList.add('with-sidebar');
  }
  
  if (quizInterface) {
    quizInterface.classList.add('with-controls');
  }
}

function hideTopControls() {
  const leftSidebar = document.getElementById('left-sidebar');
  const mainContent = document.querySelector('.main-content');
  const quizInterface = document.querySelector('.quiz-interface');
  const controlFab = document.getElementById('control-fab');
  const sidebarFab = document.getElementById('sidebar-fab');
  
  // Hide FABs
  if (controlFab) {
    controlFab.classList.remove('active');
  }
  
  if (sidebarFab) {
    sidebarFab.classList.remove('active');
  }
  
  if (leftSidebar) {
    leftSidebar.style.display = 'none';
  }
  
  if (mainContent) {
    mainContent.classList.remove('with-sidebar');
  }
  
  if (quizInterface) {
    quizInterface.classList.remove('with-controls');
  }
}

function hideQuizList() {
  const quizListContainer = document.getElementById('quiz-list-container');
  if (quizListContainer) {
    quizListContainer.style.display = 'none';
  }
}

function parseQuestions(lines, fileName) {
  const questions = [];
  let currentQuestion = [];
  let questionCount = 0;
  
  const hasABCD = fileName.includes('(ABCD)');
  const hasVariableAnswers = fileName.includes('(-)');
  
  // For files with (-), parse by blank lines (variable answer count)
  if (hasVariableAnswers) {
    lines.forEach((line) => {
      if (line.trim() === '') {
        // Blank line indicates end of question block
        if (currentQuestion.length > 0) {
          questions.push(currentQuestion.join('\n'));
          questionCount++;
          // Treat all questions as level 1 (no level text added)
          levelCounts[1] = (levelCounts[1] || 0) + 1;
          currentQuestion = [];
        }
      } else {
        currentQuestion.push(line);
      }
    });
    
    // Push last question if exists
    if (currentQuestion.length > 0) {
      questions.push(currentQuestion.join('\n'));
      questionCount++;
      levelCounts[1] = (levelCounts[1] || 0) + 1;
    }
  } else {
    // Original logic for fixed answer count files
    const answersPerQuestion = hasABCD ? 5 : 4;

    lines.forEach((line, index) => {
      if ((index > 0 && index % answersPerQuestion === 0) || index === 0) {
        if (currentQuestion.length > 0) {
          questions.push(currentQuestion.join('\n'));
        }
        currentQuestion = [line];
        questionCount++;
        
        // Extract level information
        const levelMatch = line.match(/\(\s*(level|Level)\s*(\d+)\)/);
        if (levelMatch) {
          const level = parseInt(levelMatch[2]);
          levelCounts[level] = (levelCounts[level] || 0) + 1;
        } else {
          levelCounts[1] = (levelCounts[1] || 0) + 1;
        }
      } else {
        currentQuestion.push(line);
      }
    });

    if (currentQuestion.length > 0) {
      questions.push(currentQuestion.join('\n'));
    }
  }

  return questions;
}

function updateQuizInfo(questionCount) {
  const maxQuestionsInfo = document.getElementById('max-questions-info');
  if (maxQuestionsInfo) {
    let levelInfo = Object.entries(levelCounts)
      .map(([level, count]) => `Level ${level}: ${count}`)
      .join(', ');
    
    maxQuestionsInfo.innerHTML = `
      <strong>Total questions: ${questionCount}</strong><br>
      <small>${levelInfo}</small>
    `;
  }
}

function createTopLevelCheckboxes() {
  const checkboxContainer = document.getElementById('level-checkboxes');
  if (!checkboxContainer) return;

  checkboxContainer.innerHTML = '';
  
  Object.entries(levelCounts).forEach(([level, count]) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'checkbox-wrapper';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `level-${level}`;
    checkbox.checked = true;
    
    const label = document.createElement('label');
    label.htmlFor = `level-${level}`;
    label.textContent = `L${level} (${count})`;
    
    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    checkboxContainer.appendChild(wrapper);
    
    // Add event listener to update quiz when levels change
    checkbox.addEventListener('change', () => {
      if (currentQuizState.allQuestions && currentQuizState.allQuestions.length > 0) {
        updateQuizWithNewLevels();
      }
    });
  });
}

function setupTopQuestionCountInput(questions) {
  const questionCountInput = document.getElementById('question-count');
  if (!questionCountInput) return;

  const maxQuestions = questions.length;
  GlobalselectedCount = Math.min(20, maxQuestions);
  pendingQuestionCount = GlobalselectedCount;
  
  questionCountInput.value = GlobalselectedCount;
  questionCountInput.max = maxQuestions;
  
  // Remove old listeners
  questionCountInput.removeEventListener('input', questionCountInput._inputHandler);
  questionCountInput.removeEventListener('keypress', questionCountInput._keypressHandler);
  questionCountInput.removeEventListener('change', questionCountInput._changeHandler);
  
  // Add new input handler - only store the value, don't apply it
  questionCountInput._inputHandler = (e) => {
    let value = parseInt(e.target.value);
    if (value > 0) {
      // Cap value at maximum if it exceeds
      if (value > maxQuestions) {
        value = maxQuestions;
        e.target.value = value;
      }
      pendingQuestionCount = value;
      // Add visual indicator that value hasn't been applied yet
      if (value !== GlobalselectedCount) {
        questionCountInput.style.borderColor = '#f59e0b'; // Orange border to show pending change
        questionCountInput.title = 'Press Enter to apply the new question count';
      } else {
        questionCountInput.style.borderColor = '';
        questionCountInput.title = '';
      }
    }
  };
  
  // Apply the pending value only when Enter is pressed
  questionCountInput._keypressHandler = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      let value = parseInt(e.target.value);
      if (value > 0) {
        // Cap value at maximum if it exceeds
        if (value > maxQuestions) {
          value = maxQuestions;
          e.target.value = value;
        }
        if (value !== GlobalselectedCount) {
          applyQuestionCountChange(value, maxQuestions);
          questionCountInput.style.borderColor = '';
          questionCountInput.title = '';
        }
      }
    }
  };
  
  questionCountInput.addEventListener('input', questionCountInput._inputHandler);
  questionCountInput.addEventListener('keypress', questionCountInput._keypressHandler);
}

// Apply question count change with loading screen
function applyQuestionCountChange(newCount, maxQuestions) {
  if (!currentQuizState.allQuestions || currentQuizState.allQuestions.length === 0) {
    return;
  }
  
  // Prevent changes after submission
  if (currentQuizState.hasSubmitted) {
    showNotification('Cannot change question count after submission', 'error');
    return;
  }
  
  // Show loading screen
  showLoadingScreen('Updating Question Count', `Loading ${newCount} questions...`);
  
  // Small delay for better UX
  setTimeout(() => {
    GlobalselectedCount = newCount;
    pendingQuestionCount = newCount;
    changeQuestionCount(newCount);
    hideLoadingScreen();
  }, 300);
}

function updateQuizWithNewLevels() {
  if (!currentQuizState.allQuestions) return;
  
  // Prevent changes after submission
  if (currentQuizState.hasSubmitted) {
    showNotification('Cannot change levels after submission', 'error');
    return;
  }
  
  const selectedLevels = getSelectedLevels();
  currentQuizState.selectedLevels = selectedLevels;
  
  // Get current answers before regenerating
  const currentAnswers = {};
  document.querySelectorAll('.question').forEach((questionDiv) => {
    const checkedRadio = questionDiv.querySelector('input[type="radio"]:checked');
    if (checkedRadio) {
      const questionText = questionDiv.querySelector('h3').textContent;
      currentAnswers[questionText] = {
        value: checkedRadio.value,
        isCorrect: checkedRadio.dataset.correct === "true"
      };
    }
  });
  
  // Regenerate quiz with new levels - preserve order by creating new full shuffled order
  const filteredQuestions = filterQuestionsByLevel(currentQuizState.allQuestions, selectedLevels);
  
  // Create new shuffled order for the new level selection
  const shuffledFullOrder = shuffle(filteredQuestions);
  currentQuizState.originalQuestionOrder = shuffledFullOrder;
  const selectedQuestions = shuffledFullOrder.slice(0, GlobalselectedCount);
  
  if (selectedQuestions.length === 0) {
    showNotification('No questions available for selected levels', 'error');
    return;
  }
  
  // Clear and redisplay questions
  const quizContainer = document.getElementById('quiz-container');
  quizContainer.innerHTML = '';
  
  // Show loading during level change
  showLoading();
  disableAllControlsDuringLoad();

  // Create all questions immediately with preserved answers
  selectedQuestions.forEach((questionText, index) => {
    const questionElement = createQuestionElement(questionText, index);
    quizContainer.appendChild(questionElement);
    addFadeInAnimation(questionElement);
    
    // Restore previous answer if it exists
    const questionTitle = questionText.split('\n')[0];
    if (currentAnswers[questionTitle]) {
      const radios = questionElement.querySelectorAll('input[type="radio"]');
      const matchingRadio = Array.from(radios).find(radio => radio.value === currentAnswers[questionTitle].value);
      if (matchingRadio) {
        matchingRadio.checked = true;
        // Add selected class for visual feedback
        const answerDiv = matchingRadio.closest('.answer');
        if (answerDiv) answerDiv.classList.add('selected');
        updateAnswerStatus(index);
        if (liveTestCheckbox && liveTestCheckbox.checked) {
          updateLiveScore();
          highlightLiveAnswers(questionElement);
        }
      }
    }
  });
  
  // Update results container immediately
  setupResultsContainer(selectedQuestions.length);
  
  // Maintain live test mode if it was enabled
  if (currentQuizState.isLiveMode && liveTestCheckbox && liveTestCheckbox.checked) {
    updateLiveScore();
  }
  
  // Re-enable controls and hide loading immediately after DOM updates
  requestAnimationFrame(() => {
    enableAllControlsAfterLoad();
    hideLoading();
    showNotification(`Updated to ${selectedLevels.length} levels with ${selectedQuestions.length} questions`, 'success');
  });
}

function createStartQuizButton(questions) {
  const startButton = document.getElementById('start-quiz-btn');
  if (!startButton) return;

  startButton.onclick = () => {
    startButton.disabled = true;
    startButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
    
    displayQuestions(questions);
    hideQuizSettings();
    startButton.disabled = false;
    startButton.innerHTML = '<i class="fas fa-play"></i> Start Quiz';
  };
}

// Save current quiz state for try again functionality
function saveQuizState(allQuestions, selectedLevels) {
  currentQuizState = {
    fileName: SelectedfileName,
    questionCount: GlobalselectedCount,
    selectedLevels: [...selectedLevels],
    isLiveMode: liveTestCheckbox ? liveTestCheckbox.checked : false,
    allQuestions: [...allQuestions]
  };
}

// Restart quiz with saved state
function restartQuiz() {
  if (!currentQuizState.fileName) {
    showNotification('No saved quiz state found', 'error');
    return;
  }
  
  // Show loading screen for better user experience
  const isLiveMode = currentQuizState.isLiveMode;
  const loadingMessage = isLiveMode ? 'Restarting Live Test' : 'Restarting Quiz';
  const loadingSubtitle = 'Please wait while questions are being reloaded...';
  showLoadingScreen(loadingMessage, loadingSubtitle);
  
  // Restore global variables
  SelectedfileName = currentQuizState.fileName;
  GlobalselectedCount = currentQuizState.questionCount;
  
  // Clear containers
  clearQuizContainer();
  
  // Reset quiz state
  window.answeredQuestions = [];
  currentQuizState.hasSubmitted = false;
  
  // Small delay to show loading screen, then start quiz
  setTimeout(() => {
    try {
      startQuizWithState(currentQuizState);
      hideLoadingScreen();
    } catch (error) {
      console.error('Error during quiz restart:', error);
      hideLoadingScreen();
      showNotification('Failed to restart quiz. Please try again.', 'error');
    }
  }, 300);
}

// Start quiz with specific state
function startQuizWithState(state) {
  const filteredQuestions = filterQuestionsByLevel(state.allQuestions, state.selectedLevels);
  
  // Create and store full shuffled order for consistent count changes
  const shuffledFullOrder = shuffle(filteredQuestions);
  currentQuizState.originalQuestionOrder = shuffledFullOrder;
  const selectedQuestions = shuffledFullOrder.slice(0, state.questionCount);
  
  if (selectedQuestions.length === 0) {
    showNotification('No questions available for selected criteria', 'error');
    return;
  }
  
  displayQuestionsDirectly(selectedQuestions, state.isLiveMode);
}

// Question display and interaction
function displayQuestions(allQuestions) {
  const quizContainer = document.getElementById('quiz-container');
  if (!quizContainer) return;

  quizContainer.innerHTML = '';
  quizContainer.className = 'quiz-interface';

  // Get selected levels
  const selectedLevels = getSelectedLevels();
  
  // Save quiz state for try again functionality
  saveQuizState(allQuestions, selectedLevels);
  
  const filteredQuestions = filterQuestionsByLevel(allQuestions, selectedLevels);
  
  // Create and store the full shuffled order once per quiz session
  const shuffledFullOrder = shuffle(filteredQuestions);
  currentQuizState.originalQuestionOrder = shuffledFullOrder;
  
  const selectedQuestions = shuffledFullOrder.slice(0, GlobalselectedCount);

  if (selectedQuestions.length === 0) {
    quizContainer.innerHTML = '<div class="no-questions">No questions available for selected criteria.</div>';
    enableAllControlsAfterLoad();
    hideLoading();
    showNotification('No questions available for selected criteria', 'error');
    return;
  }

  // Show loading while creating questions
  showLoading();
  disableAllControlsDuringLoad();

  // Create all questions immediately
  const questionElements = [];
  selectedQuestions.forEach((questionText, index) => {
    const questionElement = createQuestionElement(questionText, index);
    questionElements.push(questionElement);
  });
  
  // Add all questions to DOM at once
  questionElements.forEach(element => {
    quizContainer.appendChild(element);
    addFadeInAnimation(element);
  });

  // Setup results container immediately
  setupResultsContainer(selectedQuestions.length);
  setupLiveTestInTopControls();
  
  // Re-enable controls and hide loading immediately after DOM updates
  requestAnimationFrame(() => {
    enableAllControlsAfterLoad();
    hideLoading();
  });
}

// Display questions directly without saving state (used for restart)
function displayQuestionsDirectly(selectedQuestions, isLiveMode = false) {
  const quizContainer = document.getElementById('quiz-container');
  if (!quizContainer) return;

  quizContainer.innerHTML = '';
  quizContainer.className = 'quiz-interface';
  
  // Note: originalQuestionOrder should be set by the caller (startQuizWithState)
  // to ensure consistency with the order being displayed

  // Show loading while creating questions
  showLoading();
  disableAllControlsDuringLoad();

  // Create all questions immediately
  const questionElements = [];
  selectedQuestions.forEach((questionText, index) => {
    const questionElement = createQuestionElement(questionText, index);
    questionElements.push(questionElement);
  });
  
  // Add all questions to DOM at once
  questionElements.forEach(element => {
    quizContainer.appendChild(element);
    addFadeInAnimation(element);
  });

  // Setup results container immediately
  setupResultsContainer(selectedQuestions.length);
  setupLiveTestInTopControls();
  
  // Set live test mode if specified
  if (liveTestCheckbox) {
    liveTestCheckbox.checked = isLiveMode;
    applyLiveTestUIState(isLiveMode);
  }
  
  // Re-enable controls and hide loading immediately after DOM updates
  requestAnimationFrame(() => {
    enableAllControlsAfterLoad();
    hideLoading();
    hideLoadingScreen(); // Hide the live test loading overlay
  });
}

function getSelectedLevels() {
  const checkboxes = document.querySelectorAll('#level-checkboxes input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.id.split('-')[1]));
}

function filterQuestionsByLevel(questions, selectedLevels) {
  if (selectedLevels.length === 0) return questions;
  
  return questions.filter(question => {
    const levelMatch = question.match(/\(\s*(level|Level)\s*(\d+)\)/);
    const level = levelMatch ? parseInt(levelMatch[2]) : 1;
    return selectedLevels.includes(level);
  });
}

function createQuestionElement(questionText, index) {
  const lines = questionText.split('\n');
  const questionTitle = lines[0];
  const answers = lines.slice(1);

  // Randomize answer order while preserving correct answer identification
  const shuffledAnswers = shuffle([...answers]);

  const questionDiv = document.createElement('div');
  questionDiv.className = 'question';
  questionDiv.id = `question-${index}`;
  
  const questionHeader = document.createElement('div');
  questionHeader.className = 'question-header';
  questionHeader.innerHTML = `
    <span class="question-number">Question ${index + 1}</span>
    <h3>${questionTitle.replace(/\\n/g, '<br>')}</h3>
  `;
  questionDiv.appendChild(questionHeader);

  const answersContainer = document.createElement('div');
  answersContainer.className = 'answers-container';

  shuffledAnswers.forEach((answer, answerIndex) => {
    const answerElement = createAnswerElement(answer, answerIndex, index);
    answersContainer.appendChild(answerElement);
  });

  questionDiv.appendChild(answersContainer);
  return questionDiv;
}

function createAnswerElement(answerText, answerIndex, questionIndex) {
  const isCorrect = answerText.startsWith('@@');
  const cleanText = isCorrect ? answerText.slice(2) : answerText;
  const answerLabel = String.fromCharCode(65 + answerIndex);

  const answerDiv = document.createElement('div');
  answerDiv.className = 'answer';
  answerDiv.style.cursor = 'pointer'; // Make it clear the whole box is clickable
  
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = `question${questionIndex}`;
  input.value = cleanText;
  input.id = `q${questionIndex}a${answerIndex}`;
  
  if (isCorrect) {
    input.dataset.correct = "true";
  }

  const label = document.createElement('label');
  label.htmlFor = input.id;
  label.innerHTML = `<span class="answer-label">${answerLabel}</span>${cleanText.replace(/\\n/g, '<br>')}`;

  // Add event listeners
  input.addEventListener('change', () => {
    // Remove selected class from all answers in this question
    const questionDiv = input.closest('.question');
    const allAnswers = questionDiv.querySelectorAll('.answer');
    allAnswers.forEach(answer => answer.classList.remove('selected'));
    
    // Add selected class to the chosen answer
    if (input.checked) {
      answerDiv.classList.add('selected');
    }
    
    updateAnswerStatus(questionIndex);
    if (liveTestCheckbox && liveTestCheckbox.checked) {
      updateLiveScore();
      highlightLiveAnswers(input.closest('.question'));
    }
  });

  // Make the entire answer box clickable with toggle functionality
  answerDiv.addEventListener('click', (e) => {
    // Prevent double-triggering if the radio button is clicked directly
    if (e.target === input) {
      return;
    }
    
    // Don't prevent clicks on the label - let them work naturally
    // But if clicking on label, let the browser handle it
    if (e.target === label || e.target.closest('label') === label) {
      // The browser will handle the click on label naturally
      // Just return and let the change event fire normally
      return;
    }
    
    // For clicks on the answer box itself or other elements
    // Toggle functionality: if already selected, deselect it
    if (input.checked) {
      input.checked = false;
      answerDiv.classList.remove('selected');
      // Update the progress indicator
      updateAnswerStatus(questionIndex);
      if (liveTestCheckbox && liveTestCheckbox.checked) {
        updateLiveScore();
        highlightLiveAnswers(input.closest('.question'));
      }
    } else {
      // Deselect all other answers in this question first
      const questionDiv = answerDiv.closest('.question');
      const allAnswers = questionDiv.querySelectorAll('.answer');
      allAnswers.forEach(answer => answer.classList.remove('selected'));
      
      // Select this answer
      input.checked = true;
      answerDiv.classList.add('selected');
      
      // Update immediately for live test mode
      updateAnswerStatus(questionIndex);
      if (liveTestCheckbox && liveTestCheckbox.checked) {
        updateLiveScore();
        highlightLiveAnswers(questionDiv);
      }
    }
  });

  answerDiv.appendChild(input);
  answerDiv.appendChild(label);
  return answerDiv;
}

function updateAnswerStatus(questionIndex) {
  window.answeredQuestions[questionIndex] = true;
  updateProgressIndicator(questionIndex);
}

function updateProgressIndicator(questionIndex) {
  const roundBox = document.querySelector(`#results-container .round-box[data-question-index="${questionIndex}"]`);
  
  if (!roundBox) {
    console.log('❌ Progress box not found for question:', questionIndex);
    return;
  }
  
  // Clear all existing classes
  roundBox.classList.remove('unanswered', 'answered', 'correct', 'incorrect');
  
  // If in live test mode, check if answer is correct or incorrect
  if (liveTestCheckbox && liveTestCheckbox.checked) {
    const questionDiv = document.querySelector(`#question-${questionIndex}`);
    
    if (questionDiv) {
      const radios = questionDiv.querySelectorAll('input[type="radio"]');
      const correctAnswer = Array.from(radios).find(radio => radio.dataset.correct === "true");
      const userAnswer = Array.from(radios).find(radio => radio.checked);
      
      if (userAnswer) {
        if (userAnswer === correctAnswer) {
          roundBox.classList.add('correct');
        } else {
          roundBox.classList.add('incorrect');
        }
      } else {
        roundBox.classList.add('unanswered');
      }
    }
  } else {
    // In normal mode, just mark as answered
    roundBox.classList.add('answered');
  }
}

// Live test functionality
function applyLiveTestUIState(isLiveMode) {
  if (isLiveMode) {
    setupLiveTestListeners();
    updateLiveScore();
  } else {
    removeLiveTestEffects();
    hideLiveScore();
  }
}

function handleLiveTestToggle() {
  const isLiveMode = liveTestCheckbox.checked;
  const previousLiveMode = currentQuizState.isLiveMode;
  
  // Save the current live mode state
  if (currentQuizState.fileName) {
    currentQuizState.isLiveMode = isLiveMode;
  }
  
  // Only restart if the state actually changed and we have an active quiz
  if (currentQuizState.fileName && previousLiveMode !== isLiveMode) {
    try {
      if (isLiveMode) {
        showNotification('Live test mode enabled - restarting quiz with live feedback!', 'info');
        showLoadingScreen('Enabling Live Test', 'Please wait while the quiz is being prepared...');
      } else {
        showNotification('Live test mode disabled - restarting quiz', 'info');
        showLoadingScreen('Restarting Quiz', 'Please wait while questions are being loaded...');
      }
      
      setTimeout(() => {
        try {
          restartQuiz();
        } catch (error) {
          console.error('Error during quiz restart:', error);
          hideLoadingScreen();
          showNotification('Failed to restart quiz. Please try again.', 'error');
        }
      }, 500); // Small delay to show the notification
    } catch (error) {
      console.error('Error in live test toggle:', error);
      hideLoadingScreen();
      showNotification('An error occurred. Please try again.', 'error');
    }
  } else {
    // Just apply the UI state changes without restarting
    applyLiveTestUIState(isLiveMode);
  }
}

function setupLiveTestListeners() {
  // Live test listeners are already attached in createAnswerElement
  // This function now just updates the score and highlights for existing questions
  if (liveTestCheckbox && liveTestCheckbox.checked) {
    updateLiveScore();
    // Highlight any already answered questions
    const questions = document.querySelectorAll('.question');
    questions.forEach(questionDiv => {
      const checkedRadio = questionDiv.querySelector('input[type="radio"]:checked');
      if (checkedRadio) {
        highlightLiveAnswers(questionDiv);
      }
    });
  }
}

function handleLiveTestAnswer(input, isCorrect) {
  const questionDiv = input.closest('.question');
  setTimeout(() => highlightLiveAnswers(questionDiv), 100);
}

function highlightLiveAnswers(questionDiv) {
  const radios = questionDiv.querySelectorAll('input[type="radio"]');
  const correctAnswer = Array.from(radios).find(radio => radio.dataset.correct === "true");
  const userAnswer = Array.from(radios).find(radio => radio.checked);

  radios.forEach(radio => {
    const answerDiv = radio.closest('.answer');
    answerDiv.classList.remove('correct', 'incorrect');
    
    if (radio === correctAnswer) {
      answerDiv.classList.add('correct');
    } else if (radio === userAnswer && radio !== correctAnswer) {
      answerDiv.classList.add('incorrect');
    }
  });
}

function updateLiveScore() {
  if (!liveTestCheckbox || !liveTestCheckbox.checked) return;

  const questions = document.querySelectorAll('.question');
  let correct = 0;
  let answered = 0;

  questions.forEach(questionDiv => {
    const radios = questionDiv.querySelectorAll('input[type="radio"]');
    const correctAnswer = Array.from(radios).find(radio => radio.dataset.correct === "true");
    const userAnswer = Array.from(radios).find(radio => radio.checked);

    if (userAnswer) {
      answered++;
      if (userAnswer === correctAnswer) {
        correct++;
      }
    }
  });

  showLiveScore(correct, answered);
}

// Store reference to prevent duplicate handlers
let liveTestHandler = null;

function setupLiveTestInTopControls() {
  liveTestCheckbox = document.getElementById('live-test-checkbox');
  if (!liveTestCheckbox) return;
  
  // Remove any existing event listeners to prevent duplicates
  if (liveTestHandler) {
    liveTestCheckbox.removeEventListener('change', liveTestHandler);
  }
  
  // Create and store the handler reference
  liveTestHandler = handleLiveTestToggle;
  
  // Set up live test functionality with the clean handler
  liveTestCheckbox.addEventListener('change', liveTestHandler);
  
  // Restore live test state if it was enabled (without triggering handlers)
  if (currentQuizState.isLiveMode) {
    liveTestCheckbox.checked = true;
    // Apply UI state directly without triggering the toggle event
    applyLiveTestUIState(true);
  }
  
  console.log('✅ Live test event handler properly attached');
}

function showLiveScore(correct, answered) {
  // Show live score in floating widget
  let floatingScore = document.getElementById('floating-live-score');
  
  if (!floatingScore) {
    floatingScore = document.createElement('div');
    floatingScore.id = 'floating-live-score';
    floatingScore.className = 'floating-live-score';
    document.body.appendChild(floatingScore);
  }

  const percentage = answered === 0 ? 0 : (correct / answered * 100).toFixed(1);
  floatingScore.innerHTML = `
    <div class="score-text">
      <i class="fas fa-chart-line score-icon"></i>
      <span>${percentage}% (${correct}/${answered})</span>
    </div>
  `;
  
  // Show the widget with animation
  setTimeout(() => {
    floatingScore.classList.add('show');
  }, 100);
}

function hideLiveScore() {
  const floatingScore = document.getElementById('floating-live-score');
  if (floatingScore) {
    floatingScore.classList.remove('show');
    setTimeout(() => {
      floatingScore.remove();
    }, 300);
  }
}

function removeLiveTestEffects() {
  const answers = document.querySelectorAll('.answer');
  answers.forEach(answer => {
    answer.classList.remove('correct', 'incorrect');
  });
}


// Change the number of questions during the test
function changeQuestionCount(newCount) {
  if (!currentQuizState.allQuestions) {
    showNotification('Cannot change question count - no quiz data available', 'error');
    return;
  }
  
  // Prevent changes after submission
  if (currentQuizState.hasSubmitted) {
    showNotification('Cannot change question count after submission', 'error');
    return;
  }

  // Update the question count in current state
  currentQuizState.questionCount = newCount;
  GlobalselectedCount = newCount;

  // Get all current answers before regenerating
  const currentAnswers = {};
  document.querySelectorAll('.question').forEach((questionDiv, index) => {
    const checkedRadio = questionDiv.querySelector('input[type="radio"]:checked');
    if (checkedRadio) {
      const questionText = questionDiv.querySelector('h3').textContent;
      currentAnswers[questionText] = {
        value: checkedRadio.value,
        isCorrect: checkedRadio.dataset.correct === "true"
      };
    }
  });

  // Generate new question set - preserve original order, don't shuffle again
  const filteredQuestions = filterQuestionsByLevel(currentQuizState.allQuestions, currentQuizState.selectedLevels);
  
  // Use the original shuffled order and take only the requested count
  let selectedQuestions;
  if (currentQuizState.originalQuestionOrder) {
    // Filter the original order to match current level selection, then take requested count
    selectedQuestions = currentQuizState.originalQuestionOrder
      .filter(q => filteredQuestions.includes(q))
      .slice(0, newCount);
  } else {
    // Fallback - create full shuffled order and save it
    const shuffledFullOrder = shuffle(filteredQuestions);
    currentQuizState.originalQuestionOrder = shuffledFullOrder;
    selectedQuestions = shuffledFullOrder.slice(0, newCount);
  }

  if (selectedQuestions.length === 0) {
    showNotification('No questions available for selected criteria', 'error');
    return;
  }

  // Clear and redisplay questions
  const quizContainer = document.getElementById('quiz-container');
  quizContainer.innerHTML = '';

  // Create questions with preserved answers (immediate for better responsiveness)
  selectedQuestions.forEach((questionText, index) => {
    const questionElement = createQuestionElement(questionText, index);
    quizContainer.appendChild(questionElement);
    addFadeInAnimation(questionElement);

    // Restore previous answer if it exists (dispatch change event for consistency)
    const questionTitle = questionText.split('\n')[0];
    if (currentAnswers[questionTitle]) {
      const radios = questionElement.querySelectorAll('input[type="radio"]');
      const matchingRadio = Array.from(radios).find(radio => radio.value === currentAnswers[questionTitle].value);
      if (matchingRadio) {
        matchingRadio.checked = true;
        // Dispatch change event to trigger all handlers consistently
        matchingRadio.dispatchEvent(new Event('change'));
      }
    }
  });

  // Update results container (immediate for better responsiveness)
  setupResultsContainer(selectedQuestions.length);
  
  // Live test mode will be maintained automatically through change events

  showNotification(`Updated to ${newCount} questions`, 'success');
}

// Results and scoring
function setupResultsContainer(questionCount) {
  const resultsContainer = document.getElementById('results-container');
  if (!resultsContainer) return;

  resultsContainer.innerHTML = '';
  resultsContainer.className = 'results-panel';
  window.answeredQuestions = new Array(questionCount).fill(false);

  // Add header
  const header = document.createElement('h3');
  header.innerHTML = '<i class="fas fa-clipboard-list"></i> Question Progress';
  resultsContainer.appendChild(header);

  // Create progress indicators with data attributes for stable selection
  for (let i = 0; i < questionCount; i++) {
    const roundBox = document.createElement('div');
    roundBox.className = 'round-box unanswered';
    roundBox.textContent = i + 1;
    roundBox.setAttribute('data-question-index', i);
    roundBox.onclick = () => scrollToQuestion(i);
    resultsContainer.appendChild(roundBox);
  }

  // Create action buttons
  createResultsButtons(resultsContainer);
}

function createResultsButtons(container) {
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'results-buttons';
  buttonsContainer.style.cssText = `
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  `;

  const submitBtn = document.createElement('button');
  submitBtn.className = 'primary-btn';
  submitBtn.innerHTML = '<i class="fas fa-check"></i> Submit';
  submitBtn.onclick = calculateScore;

  const tryAgainBtn = document.createElement('button');
  tryAgainBtn.className = 'secondary-btn';
  tryAgainBtn.innerHTML = '<i class="fas fa-redo"></i> Try Again';
  tryAgainBtn.onclick = () => {
    closeScoreDisplay(); // Close the floating score box
    resetProgressBoxes(); // Reset all progress box colors
    currentQuizState.hasSubmitted = false; // Reset submission state
    enableQuizControls(); // Re-enable quiz controls
    
    // Apply pending question count if it changed
    const questionCountInput = document.getElementById('question-count');
    if (questionCountInput && pendingQuestionCount !== GlobalselectedCount) {
      GlobalselectedCount = pendingQuestionCount;
      currentQuizState.questionCount = pendingQuestionCount;
      questionCountInput.value = pendingQuestionCount;
      questionCountInput.style.borderColor = '';
      questionCountInput.title = '';
    }
    
    restartQuiz();
  };

  const homeBtn = document.createElement('button');
  homeBtn.className = 'secondary-btn';
  homeBtn.innerHTML = '<i class="fas fa-home"></i> Home';
  homeBtn.onclick = listQuizzes;

  buttonsContainer.appendChild(submitBtn);
  buttonsContainer.appendChild(tryAgainBtn);
  buttonsContainer.appendChild(homeBtn);
  container.appendChild(buttonsContainer);
}


function scrollToQuestion(index) {
  const questionElement = document.getElementById(`question-${index}`);
  if (questionElement) {
    questionElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    
    // Highlight the question briefly
    questionElement.style.background = 'rgba(37, 99, 235, 0.1)';
    setTimeout(() => {
      questionElement.style.background = '';
    }, 2000);
  }
}

function calculateScore() {
  const questions = document.querySelectorAll('.question');
  let score = 0;
  let totalAnswered = 0;

  questions.forEach((questionDiv, index) => {
    const radios = questionDiv.querySelectorAll('input[type="radio"]');
    const correctAnswer = Array.from(radios).find(radio => radio.dataset.correct === "true");
    const userAnswer = Array.from(radios).find(radio => radio.checked);
    const roundBox = document.querySelector(`#results-container .round-box[data-question-index="${index}"]`);
    const questionHeader = questionDiv.querySelector('h3');

    // Reset answer styling
    radios.forEach(radio => {
      const answerDiv = radio.closest('.answer');
      answerDiv.classList.remove('correct', 'incorrect');
    });

    // Remove any existing result indicator from question header
    const existingIndicator = questionHeader.querySelector('.result-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    if (userAnswer) {
      totalAnswered++;
      
      if (userAnswer === correctAnswer) {
        score++;
        roundBox.classList.remove('unanswered', 'answered', 'incorrect');
        roundBox.classList.add('correct');
        userAnswer.closest('.answer').classList.add('correct');
        
        // Add green checkmark to question header
        const checkmark = document.createElement('i');
        checkmark.className = 'fas fa-check-circle result-indicator correct-indicator';
        checkmark.style.cssText = 'color: var(--success-color); margin-left: 10px; font-size: 1.1em;';
        questionHeader.appendChild(checkmark);
      } else {
        roundBox.classList.remove('unanswered', 'answered', 'correct');
        roundBox.classList.add('incorrect');
        userAnswer.closest('.answer').classList.add('incorrect');
        
        // Add red cross to question header
        const cross = document.createElement('i');
        cross.className = 'fas fa-times-circle result-indicator incorrect-indicator';
        cross.style.cssText = 'color: var(--error-color); margin-left: 10px; font-size: 1.1em;';
        questionHeader.appendChild(cross);
      }
      
      // Always highlight the correct answer
      if (correctAnswer) {
        correctAnswer.closest('.answer').classList.add('correct');
      }
    } else {
      roundBox.classList.remove('answered', 'correct', 'incorrect');
      roundBox.classList.add('unanswered');
      
      // Add gray cross for unanswered questions
      const cross = document.createElement('i');
      cross.className = 'fas fa-minus-circle result-indicator unanswered-indicator';
      cross.style.cssText = 'color: var(--text-muted); margin-left: 10px; font-size: 1.1em;';
      questionHeader.appendChild(cross);
      
      // Show correct answer for unanswered questions
      if (correctAnswer) {
        correctAnswer.closest('.answer').classList.add('correct');
      }
    }
  });

  // Mark quiz as submitted to prevent further changes
  currentQuizState.hasSubmitted = true;
  disableQuizControls();
  
  displayFinalScore(score, questions.length, totalAnswered);
  hideSubmitButton();
  disableAllAnswers();
  showNotification(`Quiz completed! Score: ${score}/${questions.length}`, 'success');
}

function displayFinalScore(score, total, answered) {
  // Remove any existing score display
  const existingScore = document.getElementById('floating-score-display');
  if (existingScore) {
    existingScore.remove();
  }

  // Create floating score box
  const scoreDisplay = document.createElement('div');
  scoreDisplay.id = 'floating-score-display';
  scoreDisplay.className = 'floating-score-box';

  const percentage = (score / total * 100).toFixed(1);
  const grade = getGrade(percentage);
  
  scoreDisplay.innerHTML = `
    <div class="score-header">
      <i class="fas fa-trophy"></i>
      <h3>Quiz Complete!</h3>
      <button class="close-score-btn" onclick="closeScoreDisplay()">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="score-main">
      <div class="score-value">${score}/${total}</div>
      <div class="score-percentage">${percentage}%</div>
      <div class="grade grade-${grade.toLowerCase().replace('+', 'plus')}">${grade}</div>
    </div>
    <div class="score-details">
      <div class="score-stat">
        <span class="stat-label">Answered:</span>
        <span class="stat-value">${answered}/${total}</span>
      </div>
      <div class="score-stat">
        <span class="stat-label">Correct:</span>
        <span class="stat-value">${score}/${answered || total}</span>
      </div>
    </div>
    <div class="score-message">
      ${getScoreMessage(percentage)}
    </div>
  `;

  document.body.appendChild(scoreDisplay);
  
  // Add fade-in animation
  setTimeout(() => {
    scoreDisplay.classList.add('show');
  }, 100);
}

function getScoreMessage(percentage) {
  if (percentage >= 90) return "Excellent work! Outstanding performance! 🎉";
  if (percentage >= 80) return "Great job! You have a solid understanding! 👏";
  if (percentage >= 70) return "Good work! Keep practicing to improve! 👍";
  if (percentage >= 60) return "Not bad! Review the topics and try again! 📚";
  return "Keep studying and you'll improve! Don't give up! 💪";
}

function closeScoreDisplay() {
  const scoreDisplay = document.getElementById('floating-score-display');
  if (scoreDisplay) {
    scoreDisplay.classList.remove('show');
    setTimeout(() => {
      scoreDisplay.remove();
    }, 300);
  }
}

function resetProgressBoxes() {
  const roundBoxes = document.querySelectorAll('#results-container .round-box');
  roundBoxes.forEach(box => {
    box.className = 'round-box unanswered';
  });
}

function disableAllAnswers() {
  const allAnswers = document.querySelectorAll('.answer');
  const allRadios = document.querySelectorAll('.answer input[type="radio"]');
  
  // Disable all radio buttons
  allRadios.forEach(radio => {
    radio.disabled = true;
  });
  
  // Disable answer box interactions
  allAnswers.forEach(answer => {
    answer.style.cursor = 'not-allowed';
    answer.style.opacity = '0.7';
    answer.style.pointerEvents = 'none';
  });
}

function disableQuizControls() {
  // Disable top controls
  const questionCountInput = document.getElementById('question-count');
  const liveTestCheckbox = document.getElementById('live-test-checkbox');
  const levelCheckboxes = document.querySelectorAll('#level-checkboxes input[type="checkbox"]');
  
  if (questionCountInput) questionCountInput.disabled = true;
  if (liveTestCheckbox) liveTestCheckbox.disabled = true;
  levelCheckboxes.forEach(checkbox => checkbox.disabled = true);
}

function enableQuizControls() {
  // Re-enable top controls
  const questionCountInput = document.getElementById('question-count');
  const liveTestCheckbox = document.getElementById('live-test-checkbox');
  const levelCheckboxes = document.querySelectorAll('#level-checkboxes input[type="checkbox"]');
  
  if (questionCountInput) questionCountInput.disabled = false;
  if (liveTestCheckbox) liveTestCheckbox.disabled = false;
  levelCheckboxes.forEach(checkbox => checkbox.disabled = false);
  
  // Re-enable answer interactions (they'll be recreated on restart)
  const allAnswers = document.querySelectorAll('.answer');
  allAnswers.forEach(answer => {
    answer.style.cursor = 'pointer';
    answer.style.opacity = '1';
    answer.style.pointerEvents = 'auto';
  });
}

function disableAllControlsDuringLoad() {
  // Disable top controls
  const questionCountInput = document.getElementById('question-count');
  const liveTestCheckbox = document.getElementById('live-test-checkbox');
  const levelCheckboxes = document.querySelectorAll('#level-checkboxes input[type="checkbox"]');
  
  if (questionCountInput) questionCountInput.disabled = true;
  if (liveTestCheckbox) liveTestCheckbox.disabled = true;
  levelCheckboxes.forEach(checkbox => checkbox.disabled = true);
  
  // Disable quiz boxes
  const quizBoxes = document.querySelectorAll('.quiz-box, .folder-select');
  quizBoxes.forEach(box => {
    box.style.pointerEvents = 'none';
    box.style.opacity = '0.6';
  });
}

function enableAllControlsAfterLoad() {
  // Re-enable top controls
  const questionCountInput = document.getElementById('question-count');
  const liveTestCheckbox = document.getElementById('live-test-checkbox');
  const levelCheckboxes = document.querySelectorAll('#level-checkboxes input[type="checkbox"]');
  
  if (questionCountInput) questionCountInput.disabled = false;
  if (liveTestCheckbox) liveTestCheckbox.disabled = false;
  levelCheckboxes.forEach(checkbox => checkbox.disabled = false);
  
  // Re-enable quiz boxes
  const quizBoxes = document.querySelectorAll('.quiz-box, .folder-select');
  quizBoxes.forEach(box => {
    box.style.pointerEvents = 'auto';
    box.style.opacity = '1';
  });
}

function getGrade(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  return 'F';
}

function hideSubmitButton() {
  const submitBtn = document.querySelector('#results-container .primary-btn');
  if (submitBtn && submitBtn.textContent.includes('Submit')) {
    submitBtn.style.display = 'none';
  }
}

// UI helper functions
function updateQuizTitle(title) {
  const titleElement = document.getElementById('quiz-title');
  if (titleElement) {
    titleElement.textContent = title;
  }
}

function clearQuizContainer() {
  const container = document.getElementById('quiz-container');
  if (container) {
    container.innerHTML = '';
    container.className = '';
  }
}


function hideQuizSettings() {
  const settings = document.getElementById('quiz-settings');
  if (settings) {
    settings.style.display = 'none';
  }
}

function showQuizSettings() {
  const settings = document.getElementById('quiz-settings');
  if (settings) {
    settings.style.display = 'block';
    addFadeInAnimation(settings);
  }
}

function hideQuizSelection() {
  const selection = document.getElementById('quiz-list-container');
  if (selection) {
    selection.style.display = 'none';
  }
}

function showQuizSelection() {
  const selection = document.getElementById('quiz-list-container');
  if (selection) {
    selection.style.display = 'block';
    addFadeInAnimation(selection);
  }
}

function clearLevelCheckboxes() {
  const container = document.getElementById('level-checkboxes');
  if (container) {
    container.innerHTML = '';
  }
}


// Utility functions
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Loading screen functionality
function showLoadingScreen(message = 'Preparing Live Test', subtitle = 'Please wait while questions are being loaded...') {
  const overlay = document.getElementById('loading-overlay');
  const loadingText = overlay.querySelector('.loading-text');
  const loadingSubtitle = overlay.querySelector('.loading-subtitle');
  
  if (loadingText) loadingText.textContent = message;
  if (loadingSubtitle) loadingSubtitle.textContent = subtitle;
  
  overlay.classList.add('show');
  
  // Prevent scrolling while loading
  document.body.style.overflow = 'hidden';
}

function hideLoadingScreen() {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.remove('show');
  
  // Re-enable scrolling
  document.body.style.overflow = 'auto';
}

// Debugging completed - live test functionality should now work correctly

// Floating Panel Controls
function initFloatingControls() {
  const controlFab = document.getElementById('control-fab');
  const sidebarFab = document.getElementById('sidebar-fab');
  const controlPanel = document.getElementById('control-panel');
  const panelOverlay = document.getElementById('panel-overlay');
  const closePanel = document.getElementById('close-panel');
  const leftSidebar = document.getElementById('left-sidebar');
  
  // Toggle control panel
  if (controlFab && controlPanel && panelOverlay) {
    controlFab.addEventListener('click', () => {
      const isOpen = controlPanel.classList.contains('open');
      if (isOpen) {
        closeControlPanel();
      } else {
        openControlPanel();
      }
    });
    
    closePanel.addEventListener('click', closeControlPanel);
    
    // Close any open panel/sidebar when clicking overlay
    panelOverlay.addEventListener('click', () => {
      if (controlPanel.classList.contains('open')) {
        closeControlPanel();
      }
      if (leftSidebar && leftSidebar.classList.contains('mobile-visible')) {
        closeMobileSidebar();
      }
    });
  }
  
  // Toggle mobile sidebar
  if (sidebarFab && leftSidebar) {
    sidebarFab.addEventListener('click', () => {
      const isVisible = leftSidebar.classList.contains('mobile-visible');
      if (isVisible) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    });
  }
  
  // Close panel on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (controlPanel.classList.contains('open')) {
        closeControlPanel();
      }
      if (leftSidebar.classList.contains('mobile-visible')) {
        closeMobileSidebar();
      }
    }
  });
}

function openControlPanel() {
  const controlPanel = document.getElementById('control-panel');
  const panelOverlay = document.getElementById('panel-overlay');
  const controlFab = document.getElementById('control-fab');
  
  controlPanel.classList.add('open');
  controlPanel.setAttribute('aria-hidden', 'false');
  panelOverlay.classList.add('visible');
  controlFab.setAttribute('aria-expanded', 'true');
  
  // Lock body scroll
  document.body.style.overflow = 'hidden';
  
  // Focus first input
  const firstInput = controlPanel.querySelector('input, button');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
}

function closeControlPanel() {
  const controlPanel = document.getElementById('control-panel');
  const panelOverlay = document.getElementById('panel-overlay');
  const controlFab = document.getElementById('control-fab');
  
  controlPanel.classList.remove('open');
  controlPanel.setAttribute('aria-hidden', 'true');
  panelOverlay.classList.remove('visible');
  controlFab.setAttribute('aria-expanded', 'false');
  
  // Unlock body scroll
  document.body.style.overflow = 'auto';
  
  // Return focus to FAB
  controlFab.focus();
}

function openMobileSidebar() {
  const leftSidebar = document.getElementById('left-sidebar');
  const panelOverlay = document.getElementById('panel-overlay');
  const sidebarFab = document.getElementById('sidebar-fab');
  
  leftSidebar.classList.add('mobile-visible');
  leftSidebar.style.display = 'block';
  panelOverlay.classList.add('visible');
  sidebarFab.setAttribute('aria-expanded', 'true');
  
  // Lock body scroll
  document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
  const leftSidebar = document.getElementById('left-sidebar');
  const panelOverlay = document.getElementById('panel-overlay');
  const sidebarFab = document.getElementById('sidebar-fab');
  
  leftSidebar.classList.remove('mobile-visible');
  panelOverlay.classList.remove('visible');
  sidebarFab.setAttribute('aria-expanded', 'false');
  
  // Unlock body scroll
  document.body.style.overflow = 'auto';
  
  // Return focus to FAB
  sidebarFab.focus();
}

// Enhanced error handling with loading screen cleanup
window.addEventListener('error', (e) => {
  console.error('Application error:', e.error);
  hideLoadingScreen(); // Ensure loading screen is hidden on errors
  showNotification('An error occurred. Please refresh the page.', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  hideLoadingScreen(); // Ensure loading screen is hidden on promise rejections
  showNotification('An error occurred. Please try again.', 'error');
});

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    listQuizzes,
    loadQuiz,
    calculateScore,
    shuffle
  };
}
