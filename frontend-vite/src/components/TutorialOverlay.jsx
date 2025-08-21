// src/components/TutorialOverlay.jsx
import React, { useState, useEffect } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const TutorialOverlay = ({ run, setRun, steps }) => {
  const { t } = useTranslation();

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false);
      localStorage.setItem('tutorialCompleted', 'true');
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      styles={{
        options: {
          primaryColor: '#00ff00',
          textColor: '#ffffff',
          backgroundColor: '#1a1a1a',
          zIndex: 1000,
        },
      }}
      locale={{
        back: t('tutorial.back'),
        close: t('tutorial.close'),
        last: t('tutorial.finish'),
        next: t('tutorial.next'),
        skip: t('tutorial.skip'),
      }}
      callback={handleJoyrideCallback}
    />
  );
};

export default TutorialOverlay;