import { P5CanvasInstance, ReactP5Wrapper, SketchProps} from "@p5-wrapper/react";
import React from 'react';
import { Element } from './types';

interface PlacedElement {
  element: Element;
  x: number;
  y: number;
}

interface Placeholder {
  x: number;
  y: number;
  id: string;
}

export type MySketchProps = SketchProps & {
  selectedElement: Element | null;
  onElementClick: (element: Element) => void;
  combineElement: (symbol1: string, symbol2: string, callback: (element: Element) => void) => void;
  splitElement: (symbol: string, callback: (elements: Element[]) => void) => void;
  symbolCombos: { [key: string]: Element };
  playPlop: () => void;
};

const sketch = (p5: P5CanvasInstance<MySketchProps>) => {
  let placeholders: Placeholder[] = [];
  let placedElements: PlacedElement[] = []
  let selectedElement: Element | null = null;
  let onElementClick: (element: Element) => void = () => {};
  let combineElement: (symbol1: string, symbol2: string, callback: (element: Element) => void) => void = () => {}
  let splitElement: (symbol: string, callback: (elements: Element[]) => void) => void = () => {}
  let symbolCombos: { [key: string]: Element } = {}
  let playPlop: () => void
  let selectedForDragging: PlacedElement | null = null; 

  const calculateTextBounds = (text: string, x: number, y: number, padding = 10) => {
    const textWidth = p5.textWidth(text);
    const textAscent = p5.textAscent();
    const textDescent = p5.textDescent();
    return {
      x: x - textWidth / 2 - padding,
      y: y - textAscent / 2 - padding,
      w: textWidth + padding * 2,
      h: textAscent + textDescent + padding * 2,
    };
  }

  function generateUniqueId(): string {
    return Math.random().toString(36);
  }

  function checkOverlap(newElement: PlacedElement, existingElement: PlacedElement): boolean {
    // Get the bounding boxes for each element
    const newElementBounds = calculateTextBounds(`${newElement.element.emoji} ${newElement.element.symbol}`, newElement.x, newElement.y);
    const existingElementBounds = calculateTextBounds(`${existingElement.element.emoji} ${existingElement.element.symbol}`, existingElement.x, existingElement.y);
    
    // Check if the bounding boxes overlap
    // Two rectangles overlap if the area of their intersection is positive
    return !(
      newElementBounds.x > existingElementBounds.x + existingElementBounds.w ||
      newElementBounds.x + newElementBounds.w < existingElementBounds.x ||
      newElementBounds.y > existingElementBounds.y + existingElementBounds.h ||
      newElementBounds.y + newElementBounds.h < existingElementBounds.y
    );
  }

  const isInside = (px: number, py: number, rect: { x: number; y: number; w: number; h: number }) => {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
  };

  p5.mousePressed = () => {
    if (p5.mouseButton === p5.RIGHT) {
      for (let i = 0; i < placedElements.length; i++) {
        const placed = placedElements[i];
        const bounds = calculateTextBounds(`${placed.element.emoji} ${placed.element.symbol}`, placed.x, placed.y);
        if (isInside(p5.mouseX, p5.mouseY, bounds)) {
          playPlop();
          
          // Create a placeholder for the element being split
          let placeholderId = generateUniqueId();
          const placeholder = {
            x: placed.x,
            y: placed.y,
            id: placeholderId,
          };
          placeholders.push(placeholder);
          
          // Remove the element
          placedElements.splice(i, 1);
          
          // Call splitElement
          splitElement(placed.element.symbol, (newElements) => {
            // Remove the placeholder
            placeholders = placeholders.filter(p => p.id !== placeholderId);
            
            // Place the new elements around the placeholder position
            const angleStep = Math.PI * 2 / newElements.length;
            const radius = 100;
            newElements.forEach((element, index) => {
              const angle = angleStep * index;
              const x = placeholder.x + Math.cos(angle) * radius;
              const y = placeholder.y + Math.sin(angle) * radius;
              placedElements.push({
                element,
                x,
                y
              });
            });
          });
          break;
        }
      }
    } else if (p5.mouseButton === p5.LEFT) {
      // Check if we are clicking on an element
      for (let i = 0; i < placedElements.length; i++) {
        const placed = placedElements[i];
        const bounds = calculateTextBounds(`${placed.element.emoji} ${placed.element.symbol}`, placed.x, placed.y);
        if (isInside(p5.mouseX, p5.mouseY, bounds)) {
          selectedForDragging = placed;
          break;
        }
      }
      
      // If we didn't click on an element, check if we are clicking on a placeholder
      if (!selectedForDragging) {
        for (let i = 0; i < placeholders.length; i++) {
          const placeholder = placeholders[i];
          const bounds = {
            x: placeholder.x - 20,
            y: placeholder.y - 20,
            w: 40,
            h: 40
          };
          if (isInside(p5.mouseX, p5.mouseY, bounds)) {
            // If we have a selected element, place it here
            if (selectedElement) {
              playPlop();
              
              // Check for overlap
              const newElement: PlacedElement = {
                element: selectedElement,
                x: placeholder.x,
                y: placeholder.y
              };
              
              let canPlace = true;
              for (const placed of placedElements) {
                if (checkOverlap(newElement, placed)) {
                  canPlace = false;
                  break;
                }
              }
              
              if (canPlace) {
                placedElements.push(newElement);
                placeholders.splice(i, 1);
                
                // If there is another placeholder nearby, try to combine
                for (const otherPlaceholder of placeholders) {
                  const dx = otherPlaceholder.x - placeholder.x;
                  const dy = otherPlaceholder.y - placeholder.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  if (distance < 100) {
                    // Combine the two elements
                    combineElement(selectedElement.symbol, placedElements.find(el => 
                      el.x === otherPlaceholder.x && el.y === otherPlaceholder.y
                    )?.element.symbol || '', (newElement) => {
                      // Remove the two placeholders and the two elements
                      placeholders = placeholders.filter(p => p.id !== placeholder.id && p.id !== otherPlaceholder.id);
                      placedElements = placedElements.filter(el => !(
                        el.x === placeholder.x && el.y === placeholder.y ||
                        el.x === otherPlaceholder.x && el.y === otherPlaceholder.y
                      ));
                      
                      // Place the new element in the middle
                      placedElements.push({
                        element: newElement,
                        x: (placeholder.x + otherPlaceholder.x) / 2,
                        y: (placeholder.y + otherPlaceholder.y) / 2
                      });
                    });
                    break;
                  }
                }
              }
            }
            break;
          }
        }
      }
    }
  };

  p5.mouseDragged = () => {
    if (selectedForDragging) {
      selectedForDragging.x = p5.mouseX;
      selectedForDragging.y = p5.mouseY;
    }
  };

  p5.mouseReleased = () => {
    selectedForDragging = null;
  };

  p5.setup = () => {
    p5.createCanvas(p5.windowWidth, p5.windowHeight);
    p5.textSize(24);
    p5.textAlign(p5.CENTER, p5.CENTER);
  };

  p5.updateWithProps = (props) => {
    if (props) {
      selectedElement = props.selectedElement;
      onElementClick = props.onElementClick;
      combineElement = props.combineElement;
      splitElement = props.splitElement;
      symbolCombos = props.symbolCombos;
      playPlop = props.playPlop;
    }
  };

  p5.windowResized = () => {
    p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
  };

  p5.draw = () => {
    p5.background(255);
    
    // Draw placeholders
    p5.noFill();
    p5.stroke(200);
    p5.strokeWeight(2);
    for (const placeholder of placeholders) {
      p5.circle(placeholder.x, placeholder.y, 40);
    }
    
    // Draw elements
    p5.textSize(24);
    p5.textAlign(p5.CENTER, p5.CENTER);
    for (const placed of placedElements) {
      const text = `${placed.element.emoji} ${placed.element.symbol}`;
      
      // Highlight if selected
      if (selectedElement && placed.element.symbol === selectedElement.symbol) {
        p5.fill(255, 255, 0, 100);
        const bounds = calculateTextBounds(text, placed.x, placed.y);
        p5.rect(bounds.x, bounds.y, bounds.w, bounds.h, 5);
      }
      
      p5.fill(0);
      p5.text(text, placed.x, placed.y);
    }
  };
};

interface SketchComponentProps extends MySketchProps {}

const SketchComponent: React.FC<SketchComponentProps> = (props) => {
  return <ReactP5Wrapper sketch={sketch} {...props} />;
};

export default SketchComponent;
