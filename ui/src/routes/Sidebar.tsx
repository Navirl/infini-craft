import React from 'react';
import styles from './LandingRoute.module.css';
import { Element } from './types';

interface SidebarProps {
  elements: Element[];
  setElements: React.Dispatch<React.SetStateAction<Element[]>>;
  symbolCombos: { [key: string]: Element };
  setSymbolCombos: React.Dispatch<React.SetStateAction<{ [key: string]: Element }>>;
  inverseSymbolCombos: { [key: string]: Element[] };
  setInverseSymbolCombos: React.Dispatch<React.SetStateAction<{ [key: string]: Element[] }>>;
  onElementClick: (element: Element) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ elements, setElements, symbolCombos, setSymbolCombos, onElementClick, inverseSymbolCombos, setInverseSymbolCombos }) => {
  const [sortedElements, setSortedElements] = React.useState<Element[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortCriterion, setSortCriterion] = React.useState<string>('time');
  const [isAscending, setIsAscending] = React.useState<boolean>(true);
  const [pinnedElements, setPinnedElements] = React.useState(new Set());
  // helper to safely access emoji string within Sidebar
  const getEmoji = (el: Element) => el.emoji ?? "";

  const handleElementPointerDown = (event: React.PointerEvent<HTMLDivElement>, element: Element) => {
    if (event.altKey) {
      event.stopPropagation();
      setPinnedElements((prevPinned) => {
        const newPinned = new Set(prevPinned);
        if (newPinned.has(element.symbol)) {
          newPinned.delete(element.symbol);
        } else {
          newPinned.add(element.symbol);
        }
        return newPinned;
      });
    } else {
      onElementClick(element);
    }
  };

  const directCombosMap: {[elementSymbol: string]: string[]} = {};
  Object.entries(symbolCombos).forEach(([key, value]) => {
    const comboText = key.split('+++').sort().map(symbol => {
      const foundElement = elements.find(element => element.symbol === symbol);
      return foundElement ? `${foundElement.symbol} (${foundElement.emoji})` : '';
    }).join(' + ');
    
    if (!directCombosMap[value.symbol]) {
      directCombosMap[value.symbol] = [comboText];
    } else {
      directCombosMap[value.symbol].push(comboText);
    }
  });

  // Precompute inverse combinations
  const inverseCombosMap: {[elementSymbol: string]: string[]} = {};
  Object.entries(inverseSymbolCombos).forEach(([key, value]) => {
    value.forEach(el => {
      const fromElement = elements.find(element => element.symbol === key);
      const otherElement = value.find(element => element.symbol !== el.symbol);
      const comboText = fromElement ? `${fromElement.symbol} (${fromElement.emoji}) = ${el.symbol} (${el.emoji}) + ${otherElement?.symbol} (${otherElement?.emoji})` : '';

      if (!inverseCombosMap[el.symbol]) {
        inverseCombosMap[el.symbol] = [comboText];
      } else {
        inverseCombosMap[el.symbol].push(comboText);
      }
    });
  });

  // Function to get hover text by combining precomputed texts
  const getHoverText = (elementSymbol: string) => {
    const directText = directCombosMap[elementSymbol]?.join('\n') || '';
    const inverseText = inverseCombosMap[elementSymbol]?.join('\n') || '';
    return [directText, inverseText].filter(text => text).join('\n\n');
  };

  const exportData = () => {
    const data = { elements, symbolCombos, inverseSymbolCombos };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'infini-craft-save.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
  
    if (!event.target.files || event.target.files.length === 0) {
      alert("Please select a file to import."); // Basic error handling
      return;
    }
  
    fileReader.readAsText(event.target.files[0], "UTF-8");
  
    fileReader.onload = e => {
      try {
        const parsedData = JSON.parse(e.target!.result!.toString());
        setElements(parsedData.elements);
        setSymbolCombos(parsedData.symbolCombos);
        setInverseSymbolCombos(parsedData.inverseSymbolCombos);
        localStorage.setItem('elements', JSON.stringify(parsedData.elements));
        localStorage.setItem('symbolCombos', JSON.stringify(parsedData.symbolCombos));
        localStorage.setItem('inverseSymbolCombos', JSON.stringify(parsedData.inverseSymbolCombos));
        event.target.value = ''; // Reset to allow re-importing the same file
      } catch (error) {
        alert("Error parsing JSON file");
      }
    };
  };

  React.useEffect(() => {
    let filteredElements = elements;
    if (searchQuery) {
      filteredElements = elements.filter(element => 
        element.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        element.emoji.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const sorted = [...filteredElements].sort((a, b) => {
      if (sortCriterion === 'emoji') {
        return isAscending 
          ? getEmoji(a).localeCompare(getEmoji(b))
          : getEmoji(b).localeCompare(getEmoji(a));
      } else if (sortCriterion === 'symbol') {
        return isAscending 
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol);
      } else { // 'time' or default
        return isAscending 
          ? (a.timestamp || 0) - (b.timestamp || 0)
          : (b.timestamp || 0) - (a.timestamp || 0);
      }
    });

    setSortedElements(sorted);
  }, [elements, searchQuery, sortCriterion, isAscending]);

  return (
    <div className={styles.sidebar}>
      <div className={styles.controls}>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        <select value={sortCriterion} onChange={(e) => setSortCriterion(e.target.value)} className={styles.sortSelect}>
          <option value="time">Time</option>
          <option value="emoji">Emoji</option>
          <option value="symbol">Name</option>
        </select>
        <button onClick={() => setIsAscending(!isAscending)} className={styles.sortButton}>
          {isAscending ? '↑' : '↓'}
        </button>
        <button onClick={exportData} className={styles.exportButton}>Export</button>
        <input type="file" onChange={importData} className={styles.importButton} />
      </div>
      <div className={styles.elementList}>
        {sortedElements.map((element, index) => {
          const buttonClass = `${styles.elementButton} ${pinnedElements.has(element.symbol) ? styles.pinned : ''}`;
          return (
            <div key={index} title={getHoverText(element.symbol)} className={buttonClass} onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => handleElementPointerDown(e, element)}>
              <span className={styles.elementEmoji}>{element.emoji}</span>
              <span className={styles.elementText}>{element.symbol}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;
