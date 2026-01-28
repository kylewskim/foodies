import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveUserPreferences } from '../firebase/saveReceipt';

type OnboardingStep = 1 | 2 | 3;

// Step 1 options
const helpWithOptions = [
  { id: 'using_what_i_have', label: 'Using what I already have' },
  { id: 'meal_ideas', label: 'Getting meal ideas quickly' },
  { id: 'limiting_waste', label: 'Limiting food waste' },
  { id: 'meal_variety', label: 'Having meal variety' },
];

// Step 2 options
const dietaryOptions = ['Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free', 'Low-carb'];
const allergyOptions = ['Nuts', 'Shellfish', 'Eggs', 'Soy', 'Dairy', 'Wheat'];
const exclusionOptions = ['Beef', 'Pork', 'Shellfish', 'Mushrooms', 'Cilantro', 'Onions'];

// Step 3 options
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

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [helpWith, setHelpWith] = useState<string | null>(null);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [ingredientExclusions, setIngredientExclusions] = useState<string[]>([]);
  const [notifyExpireIn, setNotifyExpireIn] = useState<string | null>(null);
  const [notifyTimeOfDay, setNotifyTimeOfDay] = useState<string | null>(null);

  const handleSkip = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveUserPreferences(user.uid, { onboardingCompleted: true });
      navigate('/');
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    if (step < 3) {
      setStep((step + 1) as OnboardingStep);
    } else {
      // Show invite modal on step 3
      setShowInviteModal(true);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as OnboardingStep);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveUserPreferences(user.uid, {
        onboardingCompleted: true,
        helpWith,
        dietaryPreferences,
        allergies,
        ingredientExclusions,
        notifyExpireIn,
        notifyTimeOfDay,
      });
      navigate('/');
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayItem = (
    array: string[],
    setArray: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    if (array.includes(item)) {
      setArray(array.filter(i => i !== item));
    } else {
      setArray([...array, item]);
    }
  };

  const renderProgressBar = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 24px 8px 16px',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Back button */}
      <button
        onClick={handleBack}
        style={{
          width: '48px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: step > 1 ? 'pointer' : 'default',
          opacity: step > 1 ? 1 : 0.3,
        }}
        disabled={step === 1}
      >
        <svg width="15" height="12" viewBox="0 0 15 12" fill="none">
          <path d="M6 1L1 6L6 11" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M1 6H14" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Progress indicators */}
      <div style={{ display: 'flex', flex: 1, gap: '8px' }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '2px',
              borderRadius: '100px',
              backgroundColor: i <= step ? '#333' : '#e7e6db',
            }}
          />
        ))}
      </div>

      {/* Skip button */}
      <button
        onClick={handleSkip}
        disabled={saving}
        style={{
          width: '48px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: '"Poppins", sans-serif',
          fontSize: '14px',
          color: '#1a1a1a',
        }}
      >
        Skip
      </button>
    </div>
  );

  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '0 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h1 style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: '28px',
          fontWeight: '300',
          color: '#11130b',
          letterSpacing: '-1.12px',
          margin: 0,
        }}>
          What would you like us to help with most?
        </h1>
        <p style={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: '13px',
          color: '#11130b',
          margin: 0,
        }}>
          Tell us what matters most to you right now
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {helpWithOptions.map(option => (
          <button
            key={option.id}
            onClick={() => setHelpWith(option.id)}
            style={{
              padding: '16px',
              borderRadius: '16px',
              border: helpWith === option.id ? '1.5px solid #073d35' : 'none',
              backgroundColor: helpWith === option.id ? '#e3e9e3' : '#efeee7',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: '"Poppins", sans-serif',
              fontSize: '16px',
              color: helpWith === option.id ? '#073d35' : '#1a1a1a',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderChip = (
    label: string,
    selected: boolean,
    onClick: () => void
  ) => (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        borderRadius: selected ? '16px' : '20000px',
        border: selected ? '1px solid #073d35' : 'none',
        backgroundColor: selected ? '#e3e9e3' : '#efeee7',
        cursor: 'pointer',
        fontFamily: '"Poppins", sans-serif',
        fontSize: '14px',
        color: '#11130b',
      }}
    >
      {label}
    </button>
  );

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '0 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h1 style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: '28px',
          fontWeight: '300',
          color: '#11130b',
          letterSpacing: '-1.12px',
          margin: 0,
        }}>
          Any food rules in your household?
        </h1>
        <p style={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: '13px',
          color: '#11130b',
          margin: 0,
        }}>
          Select all that apply to get personalized recipes
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Dietary preferences */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: '13px',
            color: '#11130b',
            margin: 0,
          }}>
            Dietary preferences
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {dietaryOptions.map(option => renderChip(
              option,
              dietaryPreferences.includes(option),
              () => toggleArrayItem(dietaryPreferences, setDietaryPreferences, option)
            ))}
          </div>
        </div>

        {/* Allergies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: '13px',
            color: '#11130b',
            margin: 0,
          }}>
            Allergies
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {allergyOptions.map(option => renderChip(
              option,
              allergies.includes(option),
              () => toggleArrayItem(allergies, setAllergies, option)
            ))}
          </div>
        </div>

        {/* Ingredient exclusions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: '13px',
            color: '#11130b',
            margin: 0,
          }}>
            Ingredient exclusions
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {exclusionOptions.map(option => renderChip(
              option,
              ingredientExclusions.includes(option),
              () => toggleArrayItem(ingredientExclusions, setIngredientExclusions, option)
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '0 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h1 style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: '28px',
          fontWeight: '300',
          color: '#11130b',
          letterSpacing: '-1.12px',
          margin: 0,
        }}>
          When is it helpful for us to notify you?
        </h1>
        <p style={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: '13px',
          color: '#11130b',
          margin: 0,
        }}>
          You can choose when and how to be notified.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Notify when expire in */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: '13px',
            color: '#11130b',
            margin: 0,
          }}>
            Notify me when expire in
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            {expireInOptions.map(option => (
              <button
                key={option.id}
                onClick={() => setNotifyExpireIn(option.id)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: notifyExpireIn === option.id ? '16px' : '20000px',
                  border: notifyExpireIn === option.id ? '1px solid #073d35' : 'none',
                  backgroundColor: notifyExpireIn === option.id ? '#e3e9e3' : '#efeee7',
                  cursor: 'pointer',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '14px',
                  color: '#11130b',
                  textAlign: 'center',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time of day */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: '13px',
            color: '#11130b',
            margin: 0,
          }}>
            Time of day
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            {timeOfDayOptions.map(option => (
              <button
                key={option.id}
                onClick={() => setNotifyTimeOfDay(option.id)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: notifyTimeOfDay === option.id ? '16px' : '20000px',
                  border: notifyTimeOfDay === option.id ? '1px solid #073d35' : 'none',
                  backgroundColor: notifyTimeOfDay === option.id ? '#e3e9e3' : '#efeee7',
                  cursor: 'pointer',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '14px',
                  color: '#11130b',
                  textAlign: 'center',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderInviteModal = () => (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(17, 19, 11, 0.5)',
        zIndex: 1000,
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#f7f6ef',
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        zIndex: 1001,
        padding: '20px 24px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Close button */}
        <button
          onClick={handleFinish}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M1 1L14 14M14 1L1 14" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          alignItems: 'center',
          marginTop: '56px',
        }}>
          {/* Heading */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <h2 style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '28px',
              fontWeight: '300',
              color: '#11130b',
              letterSpacing: '-1.12px',
              margin: 0,
            }}>
              Invite family members
            </h2>
            <p style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '13px',
              color: '#11130b',
              margin: 0,
            }}>
              Invite family members and start managing your food at home together!
            </p>
          </div>

          {/* Illustration */}
          <div style={{
            width: '240px',
            height: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '120px',
          }}>
            🎉
          </div>

          {/* Send invite button */}
          <button
            onClick={handleFinish}
            disabled={saving}
            style={{
              width: '100%',
              maxWidth: '327px',
              padding: '15px',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: '#e3fd5c',
              cursor: 'pointer',
              fontFamily: '"Poppins", sans-serif',
              fontSize: '16px',
              fontWeight: '500',
              color: '#073d35',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Send invite'}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div style={{
      height: '100dvh',
      backgroundColor: '#f7f6ef',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Progress bar */}
      {renderProgressBar()}

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingTop: '24px',
        paddingBottom: '120px',
      }}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      {/* Bottom button */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 24px 40px',
        backgroundColor: '#f7f6ef',
      }}>
        <button
          onClick={handleContinue}
          disabled={saving}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: '9999px',
            border: 'none',
            backgroundColor: '#073d35',
            cursor: 'pointer',
            fontFamily: '"Poppins", sans-serif',
            fontSize: '16px',
            fontWeight: '500',
            color: '#f7f6ef',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {step === 3 ? 'Done' : 'Continue'}
        </button>
      </div>

      {/* Invite modal */}
      {showInviteModal && renderInviteModal()}
    </div>
  );
}
