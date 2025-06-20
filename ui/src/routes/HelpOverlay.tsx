import React from 'react';
import styles from './LandingRoute.module.css';

const HelpOverlay = () => {
  return (
    <div className={styles.helpContainer}>
      <div className={styles.helpButton}>?</div>
      <div className={styles.helpOverlay}>
        <ul>
          <li>🖱️+📄 Drag & drop symbols </li>
          <li>🫳📄➕📄 Drop on top to combine 🔗 </li>
          <li>🖱️➡️ Right click to split ✂️ </li>
          <li>🖱️⬆️ Middle click to duplicate 🔁 </li>
          <li>⌨️ Type to search 🔍 </li>
          <li>⎇ (Alt) + 🖱️ click sidebar to pin 📌 </li>
        </ul>
      </div>
    </div>
  );
};

export default HelpOverlay;
