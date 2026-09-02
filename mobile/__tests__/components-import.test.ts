// Smoke тесты — проверяют что компоненты импортируются без ошибок
import VisitCard from '../src/components/VisitCard';
import SyncIndicator from '../src/components/SyncIndicator';
import CustomHeader from '../src/components/CustomHeader';
import NotificationBell from '../src/components/NotificationBell';
import CameraView from '../src/components/CameraView';
import PinPad from '../src/components/PinPad';
import ParameterForm from '../src/components/ParameterForm';
import RecommendationsList from '../src/components/RecommendationsList';
import VoiceInputButton from '../src/components/VoiceInputButton';
import ConflictBanner from '../src/components/ConflictBanner';
import VisitCardSkeleton from '../src/components/VisitCardSkeleton';
import RequestCardSkeleton from '../src/components/RequestCardSkeleton';

describe('Компоненты импортируются', () => {
  test('VisitCard импортируется', () => {
    expect(VisitCard).toBeDefined();
    expect(typeof VisitCard).toBe('function');
  });

  test('SyncIndicator импортируется', () => {
    expect(SyncIndicator).toBeDefined();
    expect(typeof SyncIndicator).toBe('function');
  });

  test('CustomHeader импортируется', () => {
    expect(CustomHeader).toBeDefined();
    expect(typeof CustomHeader).toBe('function');
  });

  test('NotificationBell импортируется', () => {
    expect(NotificationBell).toBeDefined();
    expect(typeof NotificationBell).toBe('function');
  });

  test('CameraView импортируется', () => {
    expect(CameraView).toBeDefined();
    expect(typeof CameraView).toBe('function');
  });

  test('PinPad импортируется', () => {
    expect(PinPad).toBeDefined();
    expect(typeof PinPad).toBe('function');
  });

  test('ParameterForm импортируется', () => {
    expect(ParameterForm).toBeDefined();
    expect(typeof ParameterForm).toBe('function');
  });

  test('RecommendationsList импортируется', () => {
    expect(RecommendationsList).toBeDefined();
    expect(typeof RecommendationsList).toBe('function');
  });

  test('VoiceInputButton импортируется', () => {
    expect(VoiceInputButton).toBeDefined();
    expect(typeof VoiceInputButton).toBe('function');
  });

  test('ConflictBanner импортируется', () => {
    expect(ConflictBanner).toBeDefined();
    expect(typeof ConflictBanner).toBe('function');
  });

  test('VisitCardSkeleton импортируется', () => {
    expect(VisitCardSkeleton).toBeDefined();
    expect(typeof VisitCardSkeleton).toBe('function');
  });

  test('RequestCardSkeleton импортируется', () => {
    expect(RequestCardSkeleton).toBeDefined();
    expect(typeof RequestCardSkeleton).toBe('function');
  });
});
