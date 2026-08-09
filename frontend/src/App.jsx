// App.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import * as Tesseract from 'tesseract.js';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000'
  : `https://api-${window.location.hostname.replace('frontend-', '')}`;

function App() {
  // Onboarding welcome state (reads from cache for production readiness)
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => {
    return localStorage.getItem('nutriguard_onboarding_done') === 'true';
  });
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Profile preferences state
  const [profile, setProfile] = useState({
    user_id: 1,
    allergies: [],
    diets: [], 
    conditions: [],
    goals: []
  });

  // Dashboard state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState(null);
  const [history, setHistory] = useState([]);

  // Scanning states
  const [scanningMode, setScanningMode] = useState(null); // 'barcode' | 'ocr' | null
  const [scanError, setScanError] = useState(null);
  
  // OCR specific states
  const [ocrText, setOcrText] = useState('');
  const [ocrName, setOcrName] = useState('');
  const [ocrProgress, setOcrProgress] = useState('');
  const [imagePreview, setImagePreview] = useState(null);

  // Custom preference inputs
  const [customAllergenInput, setCustomAllergenInput] = useState('');
  const [customGoalInput, setCustomGoalInput] = useState('');

  // AI Chatbot States
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'assistant',
      text: "🤖 Hi! I am NutriAI, your personal health assistant. I can check safety warnings and suggest alternatives offline. If your backend server has a Google Gemini API Key configured, I'll reply using advanced AI conversationally!"
    }
  ]);

  // Webcam Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const html5QrcodeRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const chatEndRef = useRef(null);

  // Fetch initial profile & data
  useEffect(() => {
    fetchProfile();
    fetchHistory();
  }, []);

  // Scroll Reveal triggers (inspired by El Catrin scroll features)
  useEffect(() => {
    const handleScroll = () => {
      const reveals = document.querySelectorAll('.reveal');
      reveals.forEach(el => {
        const windowHeight = window.innerHeight;
        const elementTop = el.getBoundingClientRect().top;
        const elementVisible = 60; // threshold offset
        if (elementTop < windowHeight - elementVisible) {
          el.classList.add('active');
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    // Initial run with delay to accommodate initial rendering
    const timer = setTimeout(handleScroll, 200);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [productData, history, onboardingCompleted]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };



  const saveProfileUpdate = async (updated) => {
    setProfile(updated);
    try {
      await fetch(`${BACKEND_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (productData && productData.product) {
        handleSelectProduct(productData.product.code);
      }
    } catch (err) {
      console.error('Error saving profile changes:', err);
    }
  };

  const handleToggleWarning = (category, item) => {
    const list = [...(profile[category] || [])];
    const index = list.indexOf(item);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(item);
    }
    saveProfileUpdate({ ...profile, [category]: list });
  };

  const handleSelectDiet = (dietType) => {
    let list = [];
    if (dietType === 'vegan') {
      list = ['vegan'];
    } else if (dietType === 'vegetarian') {
      list = ['vegetarian'];
    }
    saveProfileUpdate({ ...profile, diets: list });
  };

  const handleToggleGoal = (goalItem) => {
    const list = [...(profile.goals || [])];
    const index = list.indexOf(goalItem);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(goalItem);
    }
    saveProfileUpdate({ ...profile, goals: list });
  };

  const handleAddCustomAllergen = (e) => {
    e.preventDefault();
    const clean = customAllergenInput.trim().toLowerCase();
    if (!clean) return;
    if (profile.allergies.includes(clean)) {
      setCustomAllergenInput('');
      return;
    }
    const updated = {
      ...profile,
      allergies: [...profile.allergies, clean]
    };
    saveProfileUpdate(updated);
    setCustomAllergenInput('');
  };

  const handleRemoveCustomAllergen = (item) => {
    const updated = {
      ...profile,
      allergies: profile.allergies.filter(a => a !== item)
    };
    saveProfileUpdate(updated);
  };

  const handleAddCustomGoal = (e) => {
    e.preventDefault();
    const clean = customGoalInput.trim().toLowerCase();
    if (!clean) return;
    if (profile.goals.includes(clean)) {
      setCustomGoalInput('');
      return;
    }
    const updated = {
      ...profile,
      goals: [...profile.goals, clean]
    };
    saveProfileUpdate(updated);
    setCustomGoalInput('');
  };

  const handleRemoveCustomGoal = (item) => {
    const updated = {
      ...profile,
      goals: profile.goals.filter(g => g !== item)
    };
    saveProfileUpdate(updated);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const queryTerm = searchQuery.trim();
    if (!queryTerm) return;
    
    // If the input is a numeric barcode, instantly run analysis instead of search results list
    if (/^\d{8,14}$/.test(queryTerm)) {
      handleSelectProduct(queryTerm);
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setProductData(null);
    setScanError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(queryTerm)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length === 0) {
          setScanError(`No products found matching "${queryTerm}". Check spelling or try a barcode.`);
        } else {
          setSearchResults(data);
          setTimeout(() => {
            scrollToSection('search-results-box');
          }, 150);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      setScanError('Failed to connect to search database.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectProduct = async (barcode) => {
    setLoading(true);
    setScanError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode })
      });
      if (res.ok) {
        const data = await res.json();
        setProductData(data);
        setSearchQuery('');
        setSearchResults([]);
        fetchHistory();
        
        // Scroll smoothly to analysis report
        setTimeout(() => {
          scrollToSection('analysis-report-section');
        }, 150);
        
        const score = data.product.nutriscore_grade?.toUpperCase() || 'unknown';
        const safety = data.evaluation.safety_status === 'safe' ? '🟢 Safe' : data.evaluation.safety_status === 'warning' ? '🟡 Warning' : '🔴 Danger';
        setChatMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: `🔍 Scanned: **${data.product.product_name}**. Safety Rating: **${safety}**. Nutri-Score: **${score}**. Ask me what makes this product safe or unsafe based on your health shield!`
          }
        ]);
      } else {
        const errData = await res.json();
        setScanError(errData.error || 'Product evaluation failed.');
      }
    } catch (err) {
      setScanError('Failed to communicate with analysis server.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };



  const startBarcodeScanner = async () => {
    setScanningMode('barcode');
    setScanError(null);
    setProductData(null);
    setSearchResults([]);

    setTimeout(() => {
      const html5Qrcode = new Html5Qrcode('barcode-scanner-view');
      html5QrcodeRef.current = html5Qrcode;
      
      html5Qrcode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 280, height: 120 }
        },
        (decodedText) => {
          stopBarcodeScanner();
          handleSelectProduct(decodedText);
        },
        () => {}
      ).catch(err => {
        // Fallback to front/default camera (critical for desktop testing)
        html5Qrcode.start(
          { facingMode: 'user' },
          {
            fps: 15,
            qrbox: { width: 280, height: 120 }
          },
          (decodedText) => {
            stopBarcodeScanner();
            handleSelectProduct(decodedText);
          },
          () => {}
        ).catch(err2 => {
          setScanError('Camera permissions were denied, camera is in use, or HTTPS is required.');
          setScanningMode(null);
          console.error(err2);
        });
      });
    }, 300);
  };

  const stopBarcodeScanner = () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      html5QrcodeRef.current.stop().then(() => {
        setScanningMode(null);
      }).catch(err => {
        console.error('Stop scanner error:', err);
        setScanningMode(null);
      });
    } else {
      setScanningMode(null);
    }
  };

  const handleBarcodeFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setScanError(null);
    setProductData(null);
    setSearchResults([]);

    try {
      const html5Qrcode = new Html5Qrcode('barcode-file-temp-div');
      const decodedText = await html5Qrcode.scanFile(file, false);
      handleSelectProduct(decodedText);
    } catch (err) {
      setScanError('Failed to detect any barcode in the uploaded photo. Try manual entry or check that the barcode is sharp.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startOcrScanner = async () => {
    setScanningMode('ocr');
    setOcrText('');
    setOcrName('');
    setOcrProgress('');
    setImagePreview(null);
    setScanError(null);
    setSearchResults([]);
    setProductData(null);

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
      } catch (e) {
        // Fallback to front camera or default camera (e.g. desktop webcam)
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      webcamStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera stream access failed:', err);
      setScanError('Webcam access was denied or secure HTTPS origin is required. You can still upload a saved photo.');
    }
  };

  const stopOcrScanner = () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => track.stop());
      webcamStreamRef.current = null;
    }
    setScanningMode(null);
  };

  const captureOcrSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setImagePreview(dataUrl);
      
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(track => track.stop());
        webcamStreamRef.current = null;
      }

      runOcrOnImage(dataUrl);
    }
  };

  const handleOcrFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setImagePreview(dataUrl);
        runOcrOnImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const runOcrOnImage = async (dataUrl) => {
    setOcrProgress('Loading scanning core...');
    try {
      const result = await Tesseract.recognize(
        dataUrl,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrProgress(`Reading label: ${(m.progress * 100).toFixed(0)}%`);
            }
          }
        }
      );
      setOcrText(result.data.text);
      setOcrProgress('Finished reading ingredients.');
    } catch (err) {
      setOcrProgress('Scan failed.');
      setScanError('Failed to parse text from the photo.');
      console.error(err);
    }
  };

  const handleSubmitOcrText = async () => {
    if (!ocrText.trim()) return;
    setLoading(true);
    setScanError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ocr_text: ocrText,
          product_name: ocrName || 'Custom Photo Scan'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setProductData(data);
        fetchHistory();
        stopOcrScanner();
        setTimeout(() => {
          scrollToSection('analysis-report-section');
        }, 150);
      } else {
        const errData = await res.json();
        setScanError(errData.error || 'OCR Analysis failed.');
      }
    } catch (err) {
      setScanError('Failed to communicate with analysis server.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissOnboarding = () => {
    localStorage.setItem('nutriguard_onboarding_done', 'true');
    setOnboardingCompleted(true);
  };

  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    const queryText = chatInput.trim();
    if (!queryText) return;

    setChatMessages(prev => [...prev, { sender: 'user', text: queryText }]);
    setChatInput('');
    setIsTyping(true);

    const runLocalAgent = () => {
      let responseText = "I can only answer questions about the active product or your health profile. Try scanning a barcode or typing 'is this safe'!";
      const cleanQuery = queryText.toLowerCase();

      const hasProduct = !!productData;
      const pName = hasProduct ? productData.product.product_name : '';
      const safety = hasProduct ? productData.evaluation.safety_status : '';
      const score = hasProduct ? productData.product.nutriscore_grade?.toUpperCase() : '';
      
      if (cleanQuery.includes('hello') || cleanQuery.includes('hi') || cleanQuery.includes('hey')) {
        responseText = "Hello! Ask me about active scanned items, what ingredients to watch out for, or how custom goals are evaluated.";
      } else if (cleanQuery.includes('safe') || cleanQuery.includes('okay') || cleanQuery.includes('compat') || cleanQuery.includes('fit') || cleanQuery.includes('suit')) {
        if (hasProduct) {
          if (safety === 'safe') {
            responseText = `Yes! **${pName}** is fully safe and compatible with your health profile. It contains no warning triggers.`;
          } else {
            responseText = `No, **${pName}** is **NOT safe** for you. It triggered warning flags: **${productData.evaluation.triggered_warnings.map(w => w.trigger).join(', ')}**!`;
          }
        } else {
          responseText = "You haven't scanned or searched a product yet. Type a barcode or scan an item in the console to evaluate safety!";
        }
      } else if (cleanQuery.includes('why') || cleanQuery.includes('warn') || cleanQuery.includes('unsa') || cleanQuery.includes('dang') || cleanQuery.includes('trigger')) {
        if (hasProduct) {
          if (productData.evaluation.triggered_warnings.length > 0) {
            responseText = `**${pName}** triggered warnings for: ${productData.evaluation.triggered_warnings.map(w => `"${w.trigger}" (${w.message})`).join('. ')}`;
          } else {
            responseText = `**${pName}** is marked safe. It has no trigger matches for your profile.`;
          }
        } else {
          responseText = "No active product. Scan an item first to audit its safety triggers!";
        }
      } else if (cleanQuery.includes('altern') || cleanQuery.includes('replac') || cleanQuery.includes('instead') || cleanQuery.includes('swap') || cleanQuery.includes('other option')) {
        if (hasProduct) {
          if (safety === 'danger' && productData.alternatives.length > 0) {
            responseText = `Based on your profile, I recommend swapping ${pName} for these safe alternatives: **${productData.alternatives.map(a => a.product_name).join(', ')}**.`;
          } else {
            responseText = `For ${pName}, no warnings were triggered. It is already safe to consume!`;
          }
        } else {
          responseText = "Please load a product first to search for compatible alternatives.";
        }
      } else if (cleanQuery.includes('grade') || cleanQuery.includes('nutriscore') || cleanQuery.includes('nutri-score')) {
        if (hasProduct) {
          responseText = `**${pName}** has a Nutri-Score of **${score}**. ${score === 'A' || score === 'B' ? 'This represents good nutritional quality.' : score === 'C' ? 'This is a moderate score.' : 'This represents poor nutritional quality (high in fats, sugars, or salt).'}`;
        } else {
          responseText = "Nutri-Score measures nutritional density from A (healthy) to E (poor). Scan a product to view its grade!";
        }
      } else if (cleanQuery.includes('sod') || cleanQuery.includes('salt') || cleanQuery.includes('blood pressure')) {
        if (hasProduct) {
          const sod = productData.product.nutriments?.sodium_100g || 0;
          responseText = `**${pName}** contains **${Math.round(sod * 1000)}mg** of sodium per 100g. Standard FDA recommends keeping daily sodium below 2,300mg.`;
        } else {
          responseText = "Toggling 'Low Sodium' under goals will alert you if any scanned food has more than 400mg of sodium per 100g.";
        }
      } else if (cleanQuery.includes('sugar') || cleanQuery.includes('diab') || cleanQuery.includes('sweet')) {
        if (hasProduct) {
          const sug = productData.product.nutriments?.sugars_100g || 0;
          responseText = `**${pName}** contains **${sug.toFixed(1)}g** of sugar per 100g. Recommended limit is under 50g daily.`;
        } else {
          responseText = "Diabetic Safe checks block products containing more than 15g of simple sugars per 100g.";
        }
      } else if (cleanQuery.includes('prot') || cleanQuery.includes('gym') || cleanQuery.includes('muscle')) {
        if (hasProduct) {
          const prot = productData.product.nutriments?.proteins_100g || 0;
          responseText = `**${pName}** has **${prot.toFixed(1)}g** of protein per 100g, contributing ${Math.round((prot / 50) * 100)}% to your daily target.`;
        } else {
          responseText = "Gym/High Protein filters target items with 10g or more of protein per 100g.";
        }
      }

      setChatMessages(prev => [...prev, { sender: 'assistant', text: responseText }]);
      setIsTyping(false);
    };

    try {
      const productContext = productData 
        ? `Current product scanned: "${productData.product.product_name}" by "${productData.product.brands}". Ingredients: "${productData.product.ingredients_text}". Safety status: "${productData.evaluation.safety_status}".`
        : 'No product currently scanned.';
      const profileContext = `User requirements: diet baseline: "${profile.diets?.join(', ') || 'None'}", allergens to avoid: "${profile.allergies?.join(', ') || 'None'}", goals to target: "${profile.goals?.join(', ') || 'None'}".`;

      const prompt = `You are NutriAI, an agentic nutrition and food safety assistant built for NutriGuard. 
Context:
${productContext}
${profileContext}

Question: "${queryText}"

CRITICAL TOPIC POLICY:
- You must ONLY answer questions that are related to food, ingredients, nutrition, health profiles, allergies, recipes, dietary baselines, or general food safety.
- If the question is NOT related to these topics (such as general knowledge, history, geography, programming, politics, sports, etc.), you MUST decline to answer and reply EXACTLY with: "I can only assist with food safety, ingredients, nutrition, and health-related questions."

Provide a concise, direct response in under 3 sentences. Emphasize how it affects their selected health profile.`;

      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { sender: 'assistant', text: data.text }]);
        setIsTyping(false);
      } else {
        runLocalAgent();
      }
    } catch (err) {
      console.error(err);
      runLocalAgent();
    }
  };

  return (
    <div className="app-container">
      
      {/* EL CATRIN STYLE COMPLIANCE WELCOME OVERLAY WITH PHOTO HEADER */}
      {!onboardingCompleted && (
        <div className="age-gate-overlay animate-fade-in">
          <div className="age-gate-container">
            <h1 className="age-gate-title">NUTRIGUARD</h1>
            <div className="age-gate-subtitle">PERSONAL HEALTH SHIELD & INGREDIENT AUDITING</div>
            <div className="age-gate-line"></div>

            <p className="age-gate-text">
              THIS WEBSITE RUNS CHEMICAL INGREDIENT MATCHING, NUTRI-SCORE EVALUATIONS, AND ALLERGEN TARGETS BASED ON YOUR ACTIVE HEALTH SHIELD PROFILE. 
              <br /><br />
              TO ENTER THE CONSOLE AND SECURE YOUR PERSONAL PROFILE PANTRY, YOU MUST CONFIRM THAT YOU WISH TO PROCEED WITH DATA ANALYSIS AND PROFILE CONTEXT MATCHING.
            </p>
            <div className="age-gate-buttons">
              <button className="age-gate-btn primary" onClick={handleDismissOnboarding}>
                <span>I AGREE & ENTER</span>
              </button>
              <button className="age-gate-btn" onClick={() => window.location.href = 'https://www.google.com'}>
                <span>EXIT SITE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER NAVBAR (No Pro Badge) */}
      <header className="header-nav animate-fade-in">
        <div className="logo-section" style={{ cursor: 'pointer' }} onClick={() => scrollToSection('console-section')}>
          <span className="logo-icon">🌿</span>
          <span className="logo-text">NutriGuard</span>
        </div>
        <nav className="nav-links">
          {/* Smooth scrolls to single-page sections */}
          <button className="nav-link" onClick={() => scrollToSection('console-section')}>
            Console
          </button>
          <button className="nav-link" onClick={() => scrollToSection('history-section')}>
            Scan History
          </button>
          <button className="nav-link" onClick={() => setSidebarVisible(!sidebarVisible)}>
            <span>{sidebarVisible ? '👁️ Hide Profile' : '👁️ Show Profile'}</span>
          </button>
          <button className="nav-link" onClick={() => setOnboardingCompleted(false)}>
            ℹ️ Verification Popup
          </button>
        </nav>
      </header>

      {/* CORE WORKSPACE LAYOUT */}
      <div className={`workspace-layout ${!sidebarVisible ? 'sidebar-hidden' : ''}`}>
        
        {/* LEFT COLUMN: THE HEALTH SHIELD SIDEBAR (Hideable) */}
        {sidebarVisible && (
          <aside className="sidebar-profile animate-fade-in">
            <div className="profile-card">
              <h3>🥗 MY DIET PROFILE & SHIELD</h3>
              <p className="desc">Toggles automatically update active scans & recommendations in real-time.</p>

              {/* 1. Diet Exclusions */}
              <div className="profile-group">
                <div className="profile-group-title">Diet Baseline</div>
                <div className="diet-toggle-group">
                  <button 
                    className={`diet-toggle-btn ${profile.diets?.length === 0 ? 'active' : ''}`}
                    onClick={() => handleSelectDiet('non-veg')}
                  >
                    🍖 Non-Veg
                  </button>
                  <button 
                    className={`diet-toggle-btn ${profile.diets?.includes('vegetarian') ? 'active veg' : ''}`}
                    onClick={() => handleSelectDiet('vegetarian')}
                  >
                    🥗 Veg
                  </button>
                  <button 
                    className={`diet-toggle-btn ${profile.diets?.includes('vegan') ? 'active veg' : ''}`}
                    onClick={() => handleSelectDiet('vegan')}
                  >
                    🥦 Vegan
                  </button>
                </div>
              </div>

              {/* 2. Specialties & Allergies Avoidance */}
              <div className="profile-group">
                <div className="profile-group-title">Allergies to Avoid</div>
                <div className="badges-container">
                  {[
                    { k: 'dairy', l: '🥛 Dairy' },
                    { k: 'gluten', l: '🌾 Gluten' },
                    { k: 'peanut', l: '🥜 Peanut' },
                    { k: 'tree-nut', l: '🌰 Tree Nut' },
                    { k: 'soy', l: '🫘 Soy' },
                    { k: 'egg', l: '🥚 Egg' },
                    { k: 'shellfish', l: '🦀 Shellfish' },
                    { k: 'sesame', l: '🌱 Sesame' }
                  ].map(item => (
                    <button
                      key={item.k}
                      className={`badge-btn ${profile.allergies?.includes(item.k) ? 'active allergy' : ''}`}
                      onClick={() => handleToggleWarning('allergies', item.k)}
                    >
                      {item.l}
                    </button>
                  ))}

                  {((profile.allergies || []).filter(a => !['dairy', 'gluten', 'peanut', 'tree-nut', 'soy', 'egg', 'shellfish', 'sesame'].includes(a))).map(item => (
                    <button
                      key={item}
                      className="badge-btn active allergy"
                      onClick={() => handleRemoveCustomAllergen(item)}
                      title="Click to remove custom allergen"
                    >
                      ⚠️ {item} <span style={{ marginLeft: '4px', opacity: 0.6 }}>✕</span>
                    </button>
                  ))}
                </div>

                <form onSubmit={handleAddCustomAllergen} style={{ display: 'flex', gap: '6px', width: '100%', marginTop: '10px' }}>
                  <input 
                    type="text" 
                    placeholder="Add other allergen (e.g. garlic)" 
                    className="input-field" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    value={customAllergenInput}
                    onChange={(e) => setCustomAllergenInput(e.target.value)}
                    list="allergen-list"
                  />
                  <button type="submit" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    <span>+</span>
                  </button>
                </form>
              </div>

              {/* 3. Health & Fitness Goals */}
              <div className="profile-group">
                <div className="profile-group-title">Active Health Goals</div>
                <div className="badges-container">
                  {[
                    { k: 'high-protein', l: '💪 High Protein' },
                    { k: 'low-carb', l: '🥑 Low Carb' },
                    { k: 'high-fiber', l: '🌾 High Fiber' },
                    { k: 'low-calorie', l: '🥗 Low Calorie' },
                    { k: 'diabetes', l: '🍭 Low Sugar' },
                    { k: 'hypertension', l: '❤️ Low Sodium' }
                  ].map(item => (
                    <button
                      key={item.k}
                      className={`badge-btn ${profile.goals?.includes(item.k) || profile.conditions?.includes(item.k) ? 'active goal' : ''}`}
                      onClick={() => {
                        if (['diabetes', 'hypertension'].includes(item.k)) {
                          handleToggleWarning('conditions', item.k);
                        } else {
                          handleToggleGoal(item.k);
                        }
                      }}
                    >
                      {item.l}
                    </button>
                  ))}

                  {((profile.goals || []).filter(g => !['high-protein', 'low-carb', 'high-fiber', 'low-calorie', 'diabetes', 'hypertension'].includes(g))).map(item => (
                    <button
                      key={item}
                      className="badge-btn active goal"
                      onClick={() => handleRemoveCustomGoal(item)}
                      title="Click to remove custom goal"
                    >
                      🎯 {item} <span style={{ marginLeft: '4px', opacity: 0.6 }}>✕</span>
                    </button>
                  ))}
                </div>

                <form onSubmit={handleAddCustomGoal} style={{ display: 'flex', gap: '6px', width: '100%', marginTop: '10px' }}>
                  <input 
                    type="text" 
                    placeholder="Add other goal (e.g. low-fat)" 
                    className="input-field" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    value={customGoalInput}
                    onChange={(e) => setCustomGoalInput(e.target.value)}
                    list="goal-list"
                  />
                  <button type="submit" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    <span>+</span>
                  </button>
                </form>
              </div>
            </div>
          </aside>
        )}

        {/* RIGHT COLUMN: LONG SINGLE PAGE FLOW WITH SCROLL REVEALS */}
        <main className="main-console">
          
          {/* SECTION 1: SEARCH & SCAN COCKPIT */}
          <section id="console-section" className="console-card reveal active">
            <h2>Scan & Analyze Products</h2>
            <p className="desc">Instant barcode lookups, text search, and client-side photo ingredient parsing.</p>

            {/* ACTION BUTTON ROW */}
            <div className="action-row">
              <form onSubmit={handleSearch} className="search-form">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by name, brand, or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="search-btn">
                  <span>Search</span>
                </button>
              </form>
            </div>

            {/* QUICK HACKATHON DEMO BUTTONS */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px', alignItems: 'center', background: '#f5f5f3', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '2px solid var(--border-dark)', boxShadow: '2px 2px 0px var(--border-dark)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', fontFamily: 'var(--font-title)' }}>💡 Quick Testing Demos:</span>
              <button 
                type="button" 
                className="badge-btn active goal" 
                style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-title)' }}
                onClick={() => {
                  setSearchQuery('030000010206');
                  handleSelectProduct('030000010206');
                }}
              >
                🌾 Quaker Oats (Safe)
              </button>
              <button 
                type="button" 
                className="badge-btn active allergy" 
                style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-title)' }}
                onClick={() => {
                  setSearchQuery('028400199148');
                  handleSelectProduct('028400199148');
                }}
              >
                🥔 Lay's Chips (High Sodium)
              </button>
              <button 
                type="button" 
                className="badge-btn active diet" 
                style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-title)' }}
                onClick={() => {
                  setSearchQuery('049000028904');
                  handleSelectProduct('049000028904');
                }}
              >
                🥤 Coca-Cola (High Sugar)
              </button>
            </div>

            {/* DYNAMIC SCANNERS & UPLOAD CONTROL BUTTONS */}
            <div className="action-row" style={{ gap: '10px' }}>
              <button className="quick-scan-btn" onClick={startBarcodeScanner}>
                <span>📷 Scan Barcode (Webcam)</span>
              </button>
              <button className="quick-scan-btn" onClick={startOcrScanner}>
                <span>📝 Scan Ingredients (Webcam)</span>
              </button>
              
              <label className="quick-scan-btn file-upload-label" style={{ cursor: 'pointer' }}>
                <span>📂 Upload Barcode Photo</span>
                <input type="file" accept="image/*" onChange={handleBarcodeFileSelect} style={{ display: 'none' }} />
              </label>

              <label className="quick-scan-btn file-upload-label" style={{ cursor: 'pointer' }}>
                <span>📂 Upload Label Photo</span>
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setScanningMode('ocr');
                    setImagePreview(null);
                    setOcrText('');
                    setOcrProgress('');
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const dataUrl = event.target.result;
                      setImagePreview(dataUrl);
                      runOcrOnImage(dataUrl);
                    };
                    reader.readAsDataURL(file);
                  }
                }} style={{ display: 'none' }} />
              </label>
            </div>

            {/* BARCODE SCANNER ELEMENT VIEWPORT */}
            {scanningMode === 'barcode' && (
              <div className="scanner-viewport-card">
                <div className="scanner-view-header">
                  <h4>Webcam Barcode Stream</h4>
                  <button className="close-scanner-btn" onClick={stopBarcodeScanner}>✕</button>
                </div>
                <div id="barcode-scanner-view" className="scanner-webcam-box" style={{ minHeight: '260px' }}></div>
              </div>
            )}

            {/* OCR SCANNER ELEMENT VIEWPORT */}
            {scanningMode === 'ocr' && (
              <div className="scanner-viewport-card">
                <div className="scanner-view-header">
                  <h4>Photo Label OCR Engine</h4>
                  <button className="close-scanner-btn" onClick={stopOcrScanner}>✕</button>
                </div>

                {!imagePreview && (
                  <div className="webcam-capture-view">
                    <video ref={videoRef} autoPlay playsInline className="scanner-webcam-box" style={{ maxHeight: '300px' }}></video>
                    <div className="capture-controls">
                      <button className="btn btn-primary" onClick={captureOcrSnapshot}>
                        <span>📸 Capture Ingredients Table</span>
                      </button>
                      <label className="btn btn-outline file-upload-label" style={{ cursor: 'pointer' }}>
                        <span>📂 Upload Image File</span>
                        <input type="file" accept="image/*" onChange={handleOcrFileSelect} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>
                )}

                {imagePreview && (
                  <div className="ocr-process-view">
                    <img src={imagePreview} alt="Preview" className="capture-preview-img" />
                    {ocrProgress && <div className="progress-indicator">{ocrProgress}</div>}
                    
                    {ocrText && (
                      <div className="extracted-textarea-box">
                        <label>Verify Extracted Ingredients Text:</label>
                        <input 
                          type="text" 
                          placeholder="Name (e.g. Protein Bar)"
                          className="input-field" 
                          value={ocrName}
                          onChange={(e) => setOcrName(e.target.value)}
                          style={{ marginBottom: '10px' }}
                        />
                        <textarea
                          className="input-field"
                          rows={5}
                          value={ocrText}
                          onChange={(e) => setOcrText(e.target.value)}
                        ></textarea>
                        <button className="btn btn-primary" onClick={handleSubmitOcrText}>
                          <span>Analyze Extracted Ingredients</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
              </div>
            )}

            {/* LOADER */}
            {loading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <p className="loader-ring">Processing product through your health profile...</p>
              </div>
            )}

            {/* SCAN ERRORS */}
            {scanError && (
              <div className="error-card">
                <div className="error-icon">⚠️</div>
                <h3>Analysis Failed</h3>
                <p>{scanError}</p>
                <button className="btn btn-outline" onClick={() => setScanError(null)}>
                  <span>Dismiss</span>
                </button>
              </div>
            )}
          </section>

          {/* SECTION 2: SEARCH RESULTS BOX */}
          {searchResults.length > 0 && (
            <section id="search-results-box" className="console-card reveal active">
              <h3>Search Results</h3>
              <div className="results-list">
                {searchResults.map(p => (
                  <div 
                    key={p.code} 
                    className="result-row"
                    onClick={() => handleSelectProduct(p.code)}
                  >
                    {p.image_front_url && <img src={p.image_front_url} alt="" />}
                    <div className="info">
                      <div className="name">{p.product_name}</div>
                      <div className="brand">{p.brands}</div>
                    </div>
                    <div className="grade">Grade: {p.nutriscore_grade?.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 3: PRODUCT ANALYSIS REPORT DETAIL */}
          {productData && (
            <section id="analysis-report-section" className="console-card reveal active">
              <h2>Product Analysis Report</h2>
              <p className="desc">Active review of matches, warning flags, and nutritional levels.</p>

              <div className="analysis-panel">
                
                {/* LEFT DETAIL COLUMN */}
                <div className="product-detail-column">
                  <div className="product-info-card">
                    {productData.product.image_front_url ? (
                      <img src={productData.product.image_front_url} alt="" className="product-thumb" />
                    ) : (
                      <div className="fav-placeholder">📦</div>
                    )}
                    <h2>{productData.product.product_name}</h2>
                    <p className="product-brand">{productData.product.brands}</p>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      border: '3px solid var(--border-dark)',
                      background: 
                        productData.product.nutriscore_grade?.toLowerCase() === 'a' ? 'var(--safe)' :
                        productData.product.nutriscore_grade?.toLowerCase() === 'b' ? '#86efac' : // Soft green
                        productData.product.nutriscore_grade?.toLowerCase() === 'c' ? 'var(--primary)' : // Yellow
                        productData.product.nutriscore_grade?.toLowerCase() === 'd' ? 'var(--warning)' : // Orange
                        productData.product.nutriscore_grade?.toLowerCase() === 'e' ? 'var(--danger)' : '#e5e7eb',
                      color: '#1e1e1e',
                      fontSize: '2rem',
                      fontWeight: '900',
                      fontFamily: 'var(--font-title)',
                      boxShadow: '3px 3px 0px var(--border-dark)',
                      margin: '16px auto'
                    }} title={`Nutri-Score Grade: ${productData.product.nutriscore_grade?.toUpperCase()}`}>
                      {productData.product.nutriscore_grade?.toUpperCase() || '?'}
                    </div>

                    <div className="product-meta">
                      <span className={`badge-pill nutriscore-${productData.product.nutriscore_grade}`} style={{ border: '2px solid var(--border-dark)', boxShadow: '2px 2px 0px var(--border-dark)', fontWeight: 'bold' }}>
                        Nutri-Score: {productData.product.nutriscore_grade?.toUpperCase()}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '12px', fontStyle: 'italic', maxWidth: '320px', lineHeight: '1.4' }}>
                      {productData.evaluation.safety_status === 'danger' ? (
                        <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                          🚨 UNSAFE PRODUCT: Even though this item has a high Nutri-Score, it contains active allergen triggers or violates your dietary baseline. AVOID CONSUMPTION.
                        </span>
                      ) : productData.evaluation.safety_status === 'warning' ? (
                        <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>
                          ⚠️ AUDIT REQUIRED: This product matches your baseline profile, but conflicts with your active health goals (e.g. excess sodium or sugar).
                        </span>
                      ) : (
                        <>
                          {productData.product.nutriscore_grade?.toLowerCase() === 'a' && '🏆 Grade A: Excellent nutritional quality. Highly recommended for daily balanced diet.'}
                          {productData.product.nutriscore_grade?.toLowerCase() === 'b' && '✨ Grade B: Good nutritional quality. A solid healthy choice.'}
                          {productData.product.nutriscore_grade?.toLowerCase() === 'c' && '⚖️ Grade C: Moderate nutritional quality. Consumable but check ingredients.'}
                          {productData.product.nutriscore_grade?.toLowerCase() === 'd' && '⚠️ Grade D: Poor nutritional quality. Eat in moderation.'}
                          {productData.product.nutriscore_grade?.toLowerCase() === 'e' && '🚨 Grade E: Very poor nutritional value. High in saturated fats, sugar, or sodium.'}
                          {(!productData.product.nutriscore_grade || ['unknown', 'none'].includes(productData.product.nutriscore_grade?.toLowerCase())) && '❓ Nutri-Score rating unavailable for this product.'}
                        </>
                      )}
                    </p>
                  </div>

                  {/* BUBBLE INGREDIENTS GRID */}
                  <div className="ingredients-grid-card">
                    <h4>Ingredient Breakdown</h4>
                    <div className="ing-bubbles-wrap">
                      {productData.evaluation.parsed_ingredients.map((ing, idx) => (
                        <span key={idx} className={`ing-bubble status-${ing.status}`}>
                          {ing.name}
                        </span>
                      ))}
                      {productData.evaluation.parsed_ingredients.length === 0 && (
                        <p className="empty-text">Ingredients list unavailable.</p>
                      )}
                    </div>
                  </div>

                  {/* NUTRITIONAL BREAKDOWN FACT CARD */}
                  <div className="ingredients-grid-card">
                    <h4>Nutrition Breakdown (per 100g)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Calories */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>
                          <span>Calories</span>
                          <span>
                            {productData.product.nutriments?.['energy-kcal_100g'] ?? 0} kcal 
                            <span style={{ fontWeight: '400', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({Math.min(100, Math.round(((productData.product.nutriments?.['energy-kcal_100g'] ?? 0) / 2000) * 100))}% DV)
                            </span>
                          </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ background: 'var(--primary)', height: '100%', width: `${Math.min(100, Math.round(((productData.product.nutriments?.['energy-kcal_100g'] ?? 0) / 2000) * 100))}%` }}></div>
                        </div>
                      </div>

                      {/* Sugar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>
                          <span>Sugars</span>
                          <span>
                            {productData.product.nutriments?.sugars_100g ?? 0}g 
                            <span style={{ fontWeight: '400', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({Math.min(100, Math.round(((productData.product.nutriments?.sugars_100g ?? 0) / 50) * 100))}% DV)
                            </span>
                          </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            background: (productData.product.nutriments?.sugars_100g ?? 0) > 15 ? 'var(--danger)' : 'var(--warning)', 
                            height: '100%', 
                            width: `${Math.min(100, Math.round(((productData.product.nutriments?.sugars_100g ?? 0) / 50) * 100))}%` 
                          }}></div>
                        </div>
                      </div>

                      {/* Sodium */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>
                          <span>Sodium</span>
                          <span>
                            {Math.round((productData.product.nutriments?.sodium_100g ?? 0) * 1000)}mg 
                            <span style={{ fontWeight: '400', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({Math.min(100, Math.round(((productData.product.nutriments?.sodium_100g ?? 0) / 2.3) * 100))}% DV)
                            </span>
                          </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            background: (productData.product.nutriments?.sodium_100g ?? 0) > 0.4 ? 'var(--danger)' : 'var(--safe)', 
                            height: '100%', 
                            width: `${Math.min(100, Math.round(((productData.product.nutriments?.sodium_100g ?? 0) / 2.3) * 100))}%` 
                          }}></div>
                        </div>
                      </div>

                      {/* Protein */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>
                          <span>Proteins</span>
                          <span>
                            {productData.product.nutriments?.proteins_100g ?? 0}g 
                            <span style={{ fontWeight: '400', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({Math.min(100, Math.round(((productData.product.nutriments?.proteins_100g ?? 0) / 50) * 100))}% DV)
                            </span>
                          </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ background: 'var(--primary)', height: '100%', width: `${Math.min(100, Math.round(((productData.product.nutriments?.proteins_100g ?? 0) / 50) * 100))}%` }}></div>
                        </div>
                      </div>

                      {/* Fiber */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>
                          <span>Dietary Fiber</span>
                          <span>
                            {productData.product.nutriments?.fiber_100g ?? 0}g 
                            <span style={{ fontWeight: '400', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({Math.min(100, Math.round(((productData.product.nutriments?.fiber_100g ?? 0) / 28) * 100))}% DV)
                            </span>
                          </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ background: 'var(--safe)', height: '100%', width: `${Math.min(100, Math.round(((productData.product.nutriments?.fiber_100g ?? 0) / 28) * 100))}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT EVALUATIONS & AUDITING COLUMN */}
                <div className="evaluation-column">
                  <div className={`safety-header-banner ${productData.evaluation.safety_status}`}>
                    {productData.evaluation.safety_status === 'safe' && '🟢 Safe / Fits Profile'}
                    {productData.evaluation.safety_status === 'warning' && '🟡 Check Label Details'}
                    {productData.evaluation.safety_status === 'danger' && '🔴 Safety Warning! Triggers Detected'}
                  </div>

                  {productData.evaluation.triggered_warnings.length > 0 && (
                    <div className="alerts-list-card">
                      <h4>⚠️ Warning Indicators</h4>
                      {productData.evaluation.triggered_warnings.map((w, idx) => (
                        <div key={idx} className="alert-row">
                          <span className="warning-badge">ALERT</span>
                          <div className="info">
                            <div className="alert-title">Triggered: "{w.trigger}"</div>
                            <p className="alert-msg">{w.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {productData.evaluation.met_goals.length > 0 && (
                    <div className="goals-list-card">
                      <h4>💪 Fitness & Nutrition Match</h4>
                      {productData.evaluation.met_goals.map((g, idx) => (
                        <div key={idx} className={`goal-card-row ${g.meets ? 'met' : 'failed'}`}>
                          <span>{g.meets ? '✅' : '❌'}</span>
                          <div className="info-box">
                            <span className="title-label">
                              {g.goal === 'high-protein' ? 'High Protein' : g.goal === 'low-carb' ? 'Low Carb (Keto)' : g.goal === 'high-fiber' ? 'High Fiber' : g.goal === 'low-calorie' ? 'Low Calorie' : g.goal}
                            </span>
                            <span className="val-label">{g.value}</span>
                            <p className="desc-label">{g.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {productData.evaluation.safety_status === 'danger' && (
                    <div className="alternatives-card">
                      <h4>🌱 Recommended Safe Alternatives</h4>
                      {productData.alternatives.map(alt => (
                        <div 
                          key={alt.code} 
                          className="alt-row-item"
                          onClick={() => handleSelectProduct(alt.code)}
                        >
                          {alt.image_front_url && <img src={alt.image_front_url} alt="" />}
                          <div className="title">
                            {alt.product_name}
                            <div className="brand">{alt.brands}</div>
                          </div>
                          <span className="safe-badge">SAFE</span>
                        </div>
                      ))}
                      {productData.alternatives.length === 0 && (
                        <p className="empty-text">No safe alternative brands found in this category.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* SECTION 4: SCAN HISTORY (Scroll Reveal) */}
          <section id="history-section" className="console-card reveal">
            <h2>Recent Scans</h2>
            <p className="desc">View history logs and details of recently analyzed food items.</p>
            <div className="history-list">
              {history.map(item => (
                <div 
                  key={item.id} 
                  className="history-card"
                  onClick={() => { scrollToSection('console-section'); handleSelectProduct(item.product_code); }}
                >
                  <div className="details">
                    <span className="product-name" style={{ fontSize: '1.25rem', fontWeight: '700' }}>{item.product_name}</span>
                    <span className="barcode" style={{ display: 'block', fontSize: '0.95rem', color: 'var(--text-muted)' }}>Barcode: {item.product_code}</span>
                  </div>
                  <span className={`status-pill status-${item.safety_status}`} style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-title)',
                    border: '2px dashed transparent',
                    borderColor: item.safety_status === 'safe' ? 'var(--safe)' : item.safety_status === 'warning' ? 'var(--warning)' : 'var(--danger)',
                    color: item.safety_status === 'safe' ? 'var(--safe)' : item.safety_status === 'warning' ? 'var(--warning)' : 'var(--danger)'
                  }}>
                    {item.safety_status.toUpperCase()}
                  </span>
                </div>
              ))}
              {history.length === 0 && (
                <p className="empty-text">Scan logs are empty. Start searching or scanning products above.</p>
              )}
            </div>
          </section>

        </main>
      </div>

      {/* FLOATING AI ASSISTANT CHATBOT DRAWER */}
      <div className="ai-chatbot-widget">
        {chatOpen ? (
          <div className="chatbot-drawer animate-fade-in">
            <div className="chatbot-header">
              <h4>🤖 NutriAI Assistant</h4>
              <button className="chatbot-close-btn" onClick={() => setChatOpen(false)}>✕</button>
            </div>

            <div className="chatbot-body">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`chat-bubble ${msg.sender}`}>
                  {msg.text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
                </div>
              ))}
              {isTyping && (
                <div className="chat-bubble assistant" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                  NutriAI is typing...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="chatbot-input-row">
              <input
                type="text"
                placeholder="Ask NutriAI anything..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendChatMessage(); }}
              />
              <button className="chatbot-send-btn" onClick={handleSendChatMessage}>
                <span>Send</span>
              </button>
            </div>

            {/* Quick Helper Questions */}
            <div className="chatbot-quick-chips">
              <button className="quick-chip" onClick={() => { setChatInput('Is this safe?'); setTimeout(() => handleSendChatMessage(), 100); }}>Is it safe?</button>
              <button className="quick-chip" onClick={() => { setChatInput('Why is it unsafe?'); setTimeout(() => handleSendChatMessage(), 100); }}>Why warning?</button>
              <button className="quick-chip" onClick={() => { setChatInput('Suggest a safe alternative'); setTimeout(() => handleSendChatMessage(), 100); }}>Alternatives?</button>
            </div>
          </div>
        ) : (
          <button className="chatbot-trigger-btn" onClick={() => setChatOpen(true)}>
            <span>🤖 NutriAI Assistant</span>
          </button>
        )}
      </div>

      {/* Native Autocomplete Datalists for Custom Allergies & Goals */}
      <datalist id="allergen-list">
        <option value="dairy" />
        <option value="milk" />
        <option value="cheese" />
        <option value="butter" />
        <option value="lactose" />
        <option value="whey" />
        <option value="casein" />
        <option value="gluten" />
        <option value="wheat" />
        <option value="flour" />
        <option value="yeast" />
        <option value="peanut" />
        <option value="tree-nut" />
        <option value="almond" />
        <option value="cashew" />
        <option value="walnut" />
        <option value="soy" />
        <option value="soybean" />
        <option value="egg" />
        <option value="shellfish" />
        <option value="shrimp" />
        <option value="crab" />
        <option value="lobster" />
        <option value="fish" />
        <option value="salmon" />
        <option value="tuna" />
        <option value="sesame" />
        <option value="mustard" />
        <option value="celery" />
        <option value="sulfites" />
        <option value="garlic" />
        <option value="onion" />
        <option value="msg" />
        <option value="tartrazine" />
        <option value="artificial-color" />
      </datalist>

      <datalist id="goal-list">
        <option value="high-protein" />
        <option value="low-carb" />
        <option value="keto" />
        <option value="high-fiber" />
        <option value="low-calorie" />
        <option value="diabetes" />
        <option value="hypertension" />
        <option value="low-sodium" />
        <option value="low-fat" />
        <option value="organic" />
        <option value="no-msg" />
        <option value="vegan" />
        <option value="vegetarian" />
      </datalist>

      {/* Temp Hidden Div for static barcode scanner file inputs */}
      <div id="barcode-file-temp-div" style={{ display: 'none' }}></div>
    </div>
  );
}

export default App;
