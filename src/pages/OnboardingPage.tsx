import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import broccoliImage from '../assets/img/broccoli.png';
import { useAuth } from '../contexts/AuthContext';
import { saveUserPreferences } from '../firebase/saveReceipt';
import { requestNotificationPermission } from '../firebase/notifications';

type OnboardingStep = 1 | 2 | 3 | 4;

const dietaryOptions = ['Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free', 'Low-carb'];
const allergyOptions = ['Nuts', 'Shellfish', 'Eggs', 'Soy', 'Dairy', 'Wheat'];
const exclusionOptions = ['Beef', 'Pork', 'Shellfish', 'Mushrooms', 'Cilantro', 'Onions'];

const expireInOptions = [
  { id: '1_day', label: '1 day' },
  { id: '3_days', label: '3 days' },
  { id: '1_week', label: '1 week' },
];

const timeOfDayOptions = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
];

const pageStyle: React.CSSProperties = {
  minHeight: '100dvh',
  backgroundColor: '#f7f6ef',
  display: 'flex',
  flexDirection: 'column',
  color: '#11130b',
};

const headingStyle: React.CSSProperties = {
  fontFamily: '"Canela", serif',
  fontSize: '28px',
  fontWeight: 300,
  letterSpacing: '-1.12px',
  lineHeight: 1.15,
  margin: 0,
};

const subheadingStyle: React.CSSProperties = {
  fontFamily: '"Poppins", sans-serif',
  fontSize: '13px',
  fontWeight: 400,
  lineHeight: 1.45,
  margin: 0,
};

const sectionLabelStyle: React.CSSProperties = {
  ...subheadingStyle,
  fontSize: '13px',
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: '9999px',
  backgroundColor: '#074135',
  color: '#f7f6ef',
  fontFamily: '"Poppins", sans-serif',
  fontSize: '16px',
  fontWeight: 500,
  lineHeight: 1.25,
  padding: '16px 24px',
  cursor: 'pointer',
};

function ProgressHeader({
  activeBars,
  onBack,
  onSkip,
}: {
  activeBars: number;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px 0 12px' }}>
      <button
        onClick={onBack}
        style={{
          width: '48px',
          height: '40px',
          border: 'none',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          cursor: 'pointer',
          padding: 0,
        }}
        aria-label="Go back"
      >
        <svg width="15" height="12" viewBox="0 0 15 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 1L1 6L6 11" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1 6H14" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
        {[1, 2].map((bar) => (
          <div
            key={bar}
            style={{
              flex: 1,
              height: '2px',
              borderRadius: '100px',
              backgroundColor: bar <= activeBars ? '#333333' : '#e7e6db',
            }}
          />
        ))}
      </div>

      <button
        onClick={onSkip}
        style={{
          width: '48px',
          height: '40px',
          border: 'none',
          background: 'transparent',
          fontFamily: '"Poppins", sans-serif',
          fontSize: '14px',
          fontWeight: 400,
          color: '#1a1a1a',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Skip
      </button>
    </div>
  );
}

function SkipHeader({ onSkip }: { onSkip: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 20px 0 12px' }}>
      <button
        onClick={onSkip}
        style={{
          width: '48px',
          height: '40px',
          border: 'none',
          background: 'transparent',
          fontFamily: '"Poppins", sans-serif',
          fontSize: '14px',
          fontWeight: 400,
          color: '#1a1a1a',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Skip
      </button>
    </div>
  );
}

function SelectChip({
  label,
  selected,
  onClick,
  grow,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  grow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: grow ? 1 : undefined,
        minWidth: grow ? 0 : undefined,
        padding: '8px 12px',
        borderRadius: '16px',
        border: selected ? '1px solid #074135' : '1px solid transparent',
        backgroundColor: selected ? '#e3e9e3' : '#efeee7',
        color: selected ? '#074135' : '#11130b',
        fontFamily: '"Poppins", sans-serif',
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: selected ? '21px' : 'normal',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        textAlign: 'center',
      }}
    >
      {label}
    </button>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, checkOnboardingStatus } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [saving, setSaving] = useState(false);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [ingredientExclusions, setIngredientExclusions] = useState<string[]>([]);
  const [notifyExpireIn, setNotifyExpireIn] = useState<string | null>('1_day');
  const [notifyTimeOfDay, setNotifyTimeOfDay] = useState<string | null>('afternoon');

  const toggleArrayItem = (
    array: string[],
    setArray: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    if (array.includes(item)) {
      setArray(array.filter((entry) => entry !== item));
      return;
    }

    setArray([...array, item]);
  };

  const completeOnboarding = async (nextPath = '/') => {
    if (!user || saving) return;

    setSaving(true);

    try {
      const pushEnabled = Boolean(notifyExpireIn && notifyTimeOfDay);

      if (pushEnabled) {
        await requestNotificationPermission(user.uid);
      }

      await saveUserPreferences(user.uid, {
        onboardingCompleted: true,
        dietaryPreferences,
        allergies,
        ingredientExclusions,
        notifyExpireIn,
        notifyTimeOfDay,
        pushEnabled,
      });

      await checkOnboardingStatus();
      navigate(nextPath, { replace: true });
    } catch (error) {
      console.error('Error saving onboarding preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding('/');
  };

  const handleContinue = async () => {
    if (step < 4) {
      setStep((step + 1) as OnboardingStep);
      return;
    }

    await completeOnboarding('/add-item?method=scan');
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as OnboardingStep);
    }
  };

  const renderWelcomeStep = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '134px 24px 40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <div style={{ width: '191px', height: '194px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src={broccoliImage}
            alt="Fresh broccoli"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        <div style={{ width: '100%', maxWidth: '327px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center', color: '#073d33' }}>
          <h1 style={{ ...headingStyle, color: '#073d33', letterSpacing: '-0.042px' }}>
            Your food, seen clearly before it&apos;s wasted.
          </h1>
          <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '16px', fontWeight: 400, lineHeight: 1.35, letterSpacing: '-0.4316px', margin: 0 }}>
            See what&apos;s still here, with expiry alert
            <br />
            and personalized recipe.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
        <button
          onClick={handleContinue}
          disabled={saving}
          style={{
            width: '100%',
            maxWidth: '220px',
            border: 'none',
            borderRadius: '16px',
            backgroundColor: '#d3e2d0',
            color: '#073d33',
            fontFamily: '"Poppins", sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: '24px',
            padding: '12px 24px',
            cursor: 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderFoodRulesStep = () => (
    <>
      <ProgressHeader activeBars={1} onBack={handleBack} onSkip={handleSkip} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 160px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h1 style={headingStyle}>Any food rules in your household?</h1>
            <p style={subheadingStyle}>Select all that apply to get personalized recipes</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={sectionLabelStyle}>Dietary preferences</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {dietaryOptions.map((option) => (
                  <SelectChip
                    key={option}
                    label={option}
                    selected={dietaryPreferences.includes(option)}
                    onClick={() => toggleArrayItem(dietaryPreferences, setDietaryPreferences, option)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={sectionLabelStyle}>Allergies</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {allergyOptions.map((option) => (
                  <SelectChip
                    key={option}
                    label={option}
                    selected={allergies.includes(option)}
                    onClick={() => toggleArrayItem(allergies, setAllergies, option)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={sectionLabelStyle}>Ingredient exclusions</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {exclusionOptions.map((option) => (
                  <SelectChip
                    key={option}
                    label={option}
                    selected={ingredientExclusions.includes(option)}
                    onClick={() => toggleArrayItem(ingredientExclusions, setIngredientExclusions, option)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '16px 20px 34px', backgroundColor: '#f7f6ef' }}>
        <button onClick={handleContinue} disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }}>
          Continue
        </button>
      </div>
    </>
  );

  const renderNotificationStep = () => (
    <>
      <ProgressHeader activeBars={2} onBack={handleBack} onSkip={handleSkip} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px 160px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h1 style={headingStyle}>When is it helpful for us to notify you?</h1>
            <p style={subheadingStyle}>You can choose when and how to be notified.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={sectionLabelStyle}>Notify me when expire in</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                {expireInOptions.map((option) => (
                  <SelectChip
                    key={option.id}
                    label={option.label}
                    selected={notifyExpireIn === option.id}
                    onClick={() => setNotifyExpireIn(option.id)}
                    grow
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={sectionLabelStyle}>Time of day</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                {timeOfDayOptions.map((option) => (
                  <SelectChip
                    key={option.id}
                    label={option.label}
                    selected={notifyTimeOfDay === option.id}
                    onClick={() => setNotifyTimeOfDay(option.id)}
                    grow
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '16px 20px 34px', backgroundColor: '#f7f6ef' }}>
        <button onClick={handleContinue} disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }}>
          Done
        </button>
      </div>
    </>
  );

  const renderReceiptStep = () => (
    <>
      <SkipHeader onSkip={handleSkip} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px 20px 34px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h1 style={headingStyle}>Let&apos;s stock up!</h1>
            <p style={{ ...subheadingStyle, color: '#333333' }}>
              Scan your grocery receipt to see your items&apos; lifespan and get recipe matches.
            </p>
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
            <img
              src="/receipt-scan-illustration.png"
              alt="Receipt scan illustration"
              style={{ width: '240px', height: '240px', objectFit: 'contain' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button onClick={handleContinue} disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }}>
            Scan my receipt
          </button>
          <button
            onClick={() => completeOnboarding('/add-item?method=manual')}
            disabled={saving}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#074135',
              fontFamily: '"Poppins", sans-serif',
              fontSize: '12px',
              fontWeight: 400,
              lineHeight: 1.4,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Add items manually instead
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div style={pageStyle}>
      {step === 1 && renderWelcomeStep()}
      {step === 2 && renderFoodRulesStep()}
      {step === 3 && renderNotificationStep()}
      {step === 4 && renderReceiptStep()}
    </div>
  );
}
