import { Link, useLocation } from 'react-router-dom';

// Import icons
import homeIcon from '../assets/icon/home.svg';
import homeFillIcon from '../assets/icon/home_fill.svg';
import recipesIcon from '../assets/icon/recipes.svg';
import recipesFillIcon from '../assets/icon/recipes_fill.svg';
import settingsIcon from '../assets/icon/settings.svg';
import settingsFillIcon from '../assets/icon/settings_fill.svg';

type NavItem = 'home' | 'recipes' | 'profile';

export function BottomNavigation() {
  const location = useLocation();

  const getActiveTab = (): NavItem => {
    if (location.pathname === '/') return 'home';
    if (location.pathname.startsWith('/recipes') || location.pathname === '/collection') return 'recipes';
    if (location.pathname === '/settings') return 'profile';
    return 'home';
  };

  const activeTab = getActiveTab();

  const navItems: { id: NavItem; label: string; path: string; icon: string; iconFill: string }[] = [
    { id: 'home', label: 'Home', path: '/', icon: homeIcon, iconFill: homeFillIcon },
    { id: 'recipes', label: 'Recipes', path: '/recipes', icon: recipesIcon, iconFill: recipesFillIcon },
    { id: 'profile', label: 'Profile', path: '/settings', icon: settingsIcon, iconFill: settingsFillIcon },
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#f7f6ef',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
      height: '72px',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      zIndex: 100,
      borderTop: '1px solid #E3E2DC',
    }}>
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        
        return (
          <Link
            key={item.id}
            to={item.path}
            style={{
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              flex: 1,
              height: '72px',
              opacity: isActive ? 1 : 0.5,
            }}
          >
            <img 
              src={isActive ? item.iconFill : item.icon} 
              alt={item.label}
              style={{
                width: '24px',
                height: '24px',
              }}
            />
            <span style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '12px',
              fontWeight: isActive ? '500' : '400',
              color: '#073d35',
              letterSpacing: '-0.24px',
              textTransform: 'capitalize',
            }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
