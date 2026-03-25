import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import './CommandCenter.css';
import { db, auth } from '../firebase';
import {collection, getDocs } from 'firebase/firestore'

/**
 * Parses a command string into arguments, supporting quotes and escapes.
 */
const parseCommandArgs = (input) => {
  const args = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if ((char === '"' || char === "'") && (!inQuotes || char === quoteChar)) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else {
        inQuotes = false;
        quoteChar = null;
      }
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) args.push(current);
  return args;
};

const CommandCenter = ({
  isOpen,
  onClose,
  handleCreateChapter,
  handleCreateAssignment,
  handleDeleteChapter,
  handleDeleteAssignment,
  handleExportAssignment,
  handleExportChapter,
  handleImportJSON,
  handleImportChapter,
  handleReload,
  handleCreateView,
  handleUpdateView,
  handleGoTo,
  handleEditNames,
  handleOpenAddQuestion,
  handleToggleBulkAdd,
  handleToggleShowTags,
  handleToggleInvert,
  handleUpdateColor,
  handleAddTag,
  handleRemoveTag,
  handleSaveNote,
  handleUploadMore,
  handleSwapQuestions,
  handleJumpTo,
  handleShowStats,
  handleSaveAdvancedView,
  showToast,
  activeQuestion,
  visibleQuestions,
  currentToast,
  assignmentsByChapter,
  aliases,
  saveAlias,
  deleteAlias,
}) => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [commandHistory, setCommandHistory] = useState(() => {
    const saved = localStorage.getItem('cc_command_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [confirming, setConfirming] = useState(null);
  
  const { chapters, tags } = useContext(AppContext);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const historyRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('cc_command_history', JSON.stringify(commandHistory));
  }, [commandHistory]);

  useEffect(() => {
    const selected = resultsRef.current?.querySelector('.command-item.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [selectedIndex, results]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    if (currentToast && isOpen) {
      addToHistory(currentToast.message, currentToast.type === 'error' ? 'error' : 'success');
    }
  }, [currentToast, isOpen]);

  const baseCommands = [
    {
      name: 'alias',
      desc: 'alias <name> <command>',
      action: (args) => {
          if (args.length < 3) return addToHistory("Usage: alias <name> <command>", "error");
          const name = args[1];
          const cmd = args.slice(2).join(' ');
          saveAlias(name, cmd);
          addToHistory(`Alias "${name}" saved for "${cmd}"`);
      }
    },
    {
        name: 'alias list',
        desc: 'list all saved aliases',
        action: () => {
            if (!aliases?.length) return addToHistory("No aliases saved", "info");
            const list = aliases.map(a => `${a.name} -> ${a.command}`).join('; ');
            addToHistory(`Aliases: ${list}`, "info");
        }
    },
    {
      name: 'unalias',
      desc: 'unalias <name>',
      action: (args) => {
          if (!args[1]) return addToHistory("Usage: unalias <name>", "error");
          deleteAlias(args[1]);
          addToHistory(`Alias "${args[1]}" deleted`);
      }
    },
    {
      name: 'stats',
      desc: 'stats [global]',
      action: (args) => {
          const isGlobal = args[1] === 'global';
          if (isGlobal) {
              const totalChaps = chapters.length;
              const totalTags = tags.length;
              addToHistory(`Global Stats: Chapters: ${totalChaps}, Tags: ${totalTags}`, "info");
          } else {
              const msg = handleShowStats();
              addToHistory(msg, "info");
          }
      }
    },
    {
      name: 'jump',
      desc: 'jump <number>',
      action: (args) => {
          const num = parseInt(args[1]);
          if (isNaN(num)) return addToHistory("Invalid number", "error");
          handleJumpTo(num);
      }
    },
    {
      name: 'swap',
      desc: 'swap <num1> <num2>',
      action: (args) => {
          const n1 = parseInt(args[1]);
          const n2 = parseInt(args[2]);
          if (isNaN(n1) || isNaN(n2)) return addToHistory("Usage: swap <num1> <num2>", "error");
          handleSwapQuestions(n1, n2);
      }
    },
    {
      name: 'view create',
      desc: 'view create "Name" where ...',
      action: async (args) => {
          const name = args[2];
          const whereIdx = args.indexOf('where');
          if (whereIdx === -1 || !name) return addToHistory('Usage: view create "Name" where tag=\'name\'', "error");
          
          const clause = args.slice(whereIdx + 1).join(' ');
          addToHistory(`Scanning database for: ${clause}...`, "info");
          
          try {
              const uid = auth.currentUser.uid;
              let collectedRefs = [];
              
              for (const chap of chapters) {
                  const asgs = assignmentsByChapter[chap.id] || [];
                  for (const asg of asgs) {
                      if (asg.isVirtual) continue;
                      
                      const qSnap = await getDocs(collection(db, "users", uid, "chapters", chap.id, "assignments", asg.id, "questions"));
                      qSnap.docs.forEach(dSnap => {
                          const data = dSnap.data();
                          const questionTagNames = (data.tags || []).map(tid => tags.find(t => t.id === tid)?.name).filter(Boolean);
                          
                          let matches = true;
                          if (clause.includes("tag='")) {
                              const targetTag = clause.split("tag='")[1].split("'")[0];
                              matches = matches && questionTagNames.includes(targetTag);
                          }
                          if (clause.includes("color='")) {
                              const targetColor = clause.split("color='")[1].split("'")[0];
                              matches = matches && (data.color || 'none') === targetColor;
                          }
                          
                          if (matches) {
                              collectedRefs.push({ chapterId: chap.id, assignmentId: asg.id, questionId: dSnap.id });
                          }
                      });
                  }
              }
              
              if (collectedRefs.length === 0) return addToHistory("No questions matched", "warning");
              await handleSaveAdvancedView(name, collectedRefs, { mode: 'advanced', clause });
          } catch (e) {
              addToHistory("Failed to create view: " + e.message, "error");
          }
      }
    },
    {
      name: 'dir',
      desc: 'dir global | dir <chapter>',
      action: (args) => {
          const arg = args[1]?.toLowerCase() || 'global';
          if (arg === 'global') {
              const list = chapters.map(c => c.name).join(', ');
              addToHistory(`Chapters: ${list || 'None'}`, "info");
          } else {
              const chap = chapters.find(c => c.name.toLowerCase().includes(arg));
              if (chap) {
                  const asgs = assignmentsByChapter?.[chap.id] || [];
                  const list = asgs.map(a => a.name).join(', ');
                  addToHistory(`Assignments in ${chap.name}: ${list || 'None'}`, "info");
              } else {
                  addToHistory(`Chapter "${arg}" not found`, "error");
              }
          }
      }
    },
    {
      name: 'history',
      desc: 'show past executed commands',
      action: () => {
          if (commandHistory.length === 0) addToHistory("No command history yet", "info");
          else addToHistory(`Recent: ${commandHistory.slice(-10).join('; ')}`, "info");
      }
    },
    {
        name: 'clear history',
        desc: 'clear saved command history',
        action: () => {
            setCommandHistory([]);
            addToHistory("Command history cleared", "info");
        }
    },
    {
        name: 'clear logs',
        desc: 'clear display logs',
        action: () => {
            setHistory([]);
        }
    },
    {
      name: 'create chapter',
      desc: 'create chapter <name>',
      action: (args) => {
          const name = args.slice(2).join(' ');
          if (!name) return addToHistory("Chapter name required", "error");
          handleCreateChapter(name);
      }
    },
    {
      name: 'create assignment',
      desc: 'create assignment <name> [in <chapter>]',
      action: (args) => {
          const name = args[2];
          const inIdx = args.indexOf('in');
          const chapterName = inIdx !== -1 ? args[inIdx + 1] : null;
          if (!name) return addToHistory("Assignment name required", "error");
          handleCreateAssignment(name, chapterName);
      }
    },
    {
      name: 'export assignment pdf',
      desc: 'export assignment pdf [filename]',
      action: (args) => handleExportAssignment('pdf', args[3])
    },
    {
      name: 'export assignment json',
      desc: 'export assignment json [filename]',
      action: (args) => handleExportAssignment('json', args[3])
    },
    {
      name: 'export chapter',
      desc: 'export current chapter',
      action: () => handleExportChapter()
    },
    {
      name: 'import json',
      desc: 'trigger import json',
      action: () => handleImportJSON()
    },
    {
      name: 'import chapter',
      desc: 'trigger import chapter',
      action: () => handleImportChapter()
    },
    {
      name: 'edit names',
      desc: 'edit chapter/assignment names',
      action: () => handleEditNames()
    },
    {
      name: 'reload',
      desc: 'reload current view',
      action: () => handleReload()
    },
    {
      name: 'create view',
      desc: 'create new virtual view',
      action: () => handleCreateView()
    },
    {
      name: 'update view',
      desc: 'update current virtual view',
      action: () => handleUpdateView()
    },
    {
      name: 'go to',
      desc: 'go to <chapter> [assignment]',
      action: (args) => {
          const chapName = args[2];
          const asgName = args[3];
          if (!chapName) return addToHistory("Chapter name required", "error");
          handleGoTo(chapName, asgName);
      }
    },
    {
      name: 'color',
      desc: 'color <name|hex|none>',
      action: (args) => {
          const colorMap = {
              'red': '#ef476f', 'yellow': '#ffd166', 'green': '#06d6a0',
              'blue': '#118ab2', 'purple': '#b185db', 'none': null
          };
          const val = (args[1] || '').toLowerCase();
          const color = colorMap[val] !== undefined ? colorMap[val] : val;
          handleUpdateColor(color);
      }
    },
    {
      name: 'add tag',
      desc: 'add tag <name> to current question',
      action: (args) => {
          const tagName = args.slice(2).join(' ');
          if (!tagName) return addToHistory("Tag name required", "error");
          handleAddTag(tagName);
      }
    },
    {
      name: 'remove tag',
      desc: 'remove tag <name> from current question',
      action: (args) => {
          const tagName = args.slice(2).join(' ');
          if (!tagName) return addToHistory("Tag name required", "error");
          const tag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
          if (tag) handleRemoveTag(tag.id);
          else addToHistory(`Tag "${tagName}" not found`, "error");
      }
    },
    {
      name: 'save note',
      desc: 'save current note',
      action: () => handleSaveNote()
    },
    {
      name: 'upload',
      desc: 'upload & append selected images',
      action: () => handleUploadMore()
    },
    {
      name: 'add question',
      desc: 'open add question page',
      action: () => handleOpenAddQuestion()
    },
    {
      name: 'toggle bulk',
      desc: 'toggle bulk add mode',
      action: () => handleToggleBulkAdd()
    },
    {
      name: 'toggle tags',
      desc: 'show/hide tags UI',
      action: () => handleToggleShowTags()
    },
    {
      name: 'toggle invert',
      desc: 'invert question images',
      action: () => handleToggleInvert()
    },
    {
      name: 'delete assignment',
      desc: 'delete current assignment',
      action: () => {
          setConfirming({
              type: 'delete_assignment',
              message: "Are you sure you want to delete this assignment and all its questions?",
              action: () => handleDeleteAssignment()
          });
      }
    },
    {
      name: 'delete chapter',
      desc: 'delete current chapter',
      action: () => {
          setConfirming({
              type: 'delete_chapter',
              message: "Are you sure you want to delete this chapter and all its assignments?",
              action: () => handleDeleteChapter()
          });
      }
    }
  ];

  // Dynamic command list (Base + Aliases)
  const allCommands = useMemo(() => {
      const aliasCommands = (aliases || []).map(a => ({
          name: a.name,
          desc: `Alias for: ${a.command}`,
          isAlias: true,
          originalCommand: a.command,
          action: () => {} // Action handled in Enter logic
      }));
      return [...baseCommands, ...aliasCommands].sort((a, b) => a.name.localeCompare(b.name));
  }, [aliases]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setInput('');
      setSelectedIndex(0);
      setConfirming(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!input) {
      setResults(allCommands);
      return;
    }

    const filtered = allCommands.filter(c => 
      c.name.toLowerCase().includes(input.toLowerCase()) ||
      input.toLowerCase().startsWith(c.name.toLowerCase())
    );
    setResults(filtered);
    setSelectedIndex(0);
  }, [input, allCommands]);

  const addToHistory = (text, type = 'success') => {
    setHistory(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }].slice(-50));
  };

  const executeCommand = (cmdInput) => {
      const args = parseCommandArgs(cmdInput);
      const firstWord = args[0]?.toLowerCase();
      
      // Check for alias expansion again just in case
      const alias = (aliases || []).find(a => a.name === firstWord);
      const finalInput = alias ? alias.command + cmdInput.substring(firstWord.length) : cmdInput;
      const finalArgs = parseCommandArgs(finalInput);
      const finalFirstWord = finalArgs[0]?.toLowerCase();

      // Find the command that matches the longest part of the start
      // e.g. "alias list" should match "alias list" not just "alias"
      const matchedCommand = baseCommands
        .filter(c => finalInput.toLowerCase().startsWith(c.name.toLowerCase()))
        .sort((a, b) => b.name.length - a.name.length)[0];

      if (matchedCommand) {
          if (cmdInput.trim()) {
              setCommandHistory(prev => [...prev.filter(c => c !== cmdInput), cmdInput].slice(-50));
          }
          if (!confirming) {
              addToHistory(`Executed: ${matchedCommand.name}`);
              setInput('');
          }
          matchedCommand.action(finalArgs);
      } else {
          addToHistory(`Unknown command: ${finalFirstWord}`, "error");
      }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (confirming) setConfirming(null);
      else onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (confirming) {
          confirming.action();
          setConfirming(null);
          return;
      }
      
      const selected = results[selectedIndex];
      if (selected) {
          // If the typed input exactly matches or is an expansion, execute it
          // Otherwise, auto-complete the suggestion
          const typedFirstWord = input.split(' ')[0].toLowerCase();
          const isExactMatch = results.some(r => r.name.toLowerCase() === input.toLowerCase());
          const isStartingWith = selected.name.toLowerCase().startsWith(input.toLowerCase());

          if (isExactMatch || !isStartingWith) {
              executeCommand(input);
          } else {
              setInput(selected.name + ' ');
              addToHistory(`Complete the command: ${selected.desc}`, 'info');
          }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-center-backdrop" onClick={onClose}>
      <div className="command-center" onClick={e => e.stopPropagation()}>
        {confirming ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--danger)', marginBottom: '12px' }}>Double Confirmation Required</h3>
            <p style={{ marginBottom: '20px' }}>{confirming.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn-danger" onClick={() => {
                  confirming.action();
                  setConfirming(null);
                  addToHistory("Action confirmed and executed", "success");
              }}>Confirm (Enter)</button>
              <button className="btn-outline-secondary" onClick={() => setConfirming(null)}>Cancel (Esc)</button>
            </div>
          </div>
        ) : (
          <>
            <div className="command-input-wrapper">
              <span className="command-icon">{">"}</span>
              <input
                ref={inputRef}
                className="command-input"
                placeholder="Type a command (dir, alias list, stats, etc.)..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        e.stopPropagation();
                    } else {
                        handleKeyDown(e);
                    }
                }}
                onPaste={(e) => {
                    e.stopPropagation();
                }}
              />
            </div>
            
            <div className="command-results" ref={resultsRef}>
              {results.length > 0 ? (
                results.map((c, i) => (
                  <div
                    key={c.name}
                    className={`command-item ${i === selectedIndex ? 'selected' : ''}`}
                    onClick={() => {
                        setSelectedIndex(i);
                        inputRef.current?.focus();
                    }}
                  >
                    <span className="command-name">
                        {c.isAlias && <span style={{ color: 'var(--secondary)', fontSize: '0.7rem', marginRight: '8px' }}>[ALIAS]</span>}
                        {c.name}
                    </span>
                    <span className="command-desc">{c.desc}</span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '16px', color: 'var(--text-secondary)' }}>No matching commands</div>
              )}
            </div>

            {history.length > 0 && (
              <div className="command-history" ref={historyRef}>
                {history.map((h, i) => (
                  <div key={i} className={`history-item ${h.type}`}>
                    [{h.time}] {h.text}
                  </div>
                ))}
              </div>
            )}

            <div className="command-center-help">
                <div>↑↓ to navigate • Enter to execute • Esc to close</div>
                <div>Aliases: <span className="kbd-shortcut">alias mt "go to Maths"</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CommandCenter;
