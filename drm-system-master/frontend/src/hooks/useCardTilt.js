import { useEffect } from 'react';

export function useCardTilt(cardRef) {
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let animId;

    const handleMouseMove = (e) => {
      const rect = card.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;

      const diffX = e.clientX - cardCenterX;
      const diffY = e.clientY - cardCenterY;

      // Limit max tilt to 6 degrees for a refined, premium feel
      targetRotY = Math.max(-7, Math.min(7, (diffX / window.innerWidth) * 14));
      targetRotX = Math.max(-7, Math.min(7, -(diffY / window.innerHeight) * 14));
    };

    const handleMouseLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
    };

    const animate = () => {
      currentRotX += (targetRotX - currentRotX) * 0.1;
      currentRotY += (targetRotY - currentRotY) * 0.1;

      card.style.transform = `perspective(1200px) rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg)`;

      animId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [cardRef]);
}
