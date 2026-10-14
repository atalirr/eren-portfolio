"""
ANTIGRAVITY AI — XGBoost Sinyal Filtresi Eğitim Scripti
========================================================
İyileştirme #6: signal_log.json verisini okuyup XGBoost modeli eğitir.

KULLANIM:
  python train_model.py

GEREKSİNİM:
  pip install xgboost scikit-learn

ÇIKTI:
  signal_filter.json  — backend.py tarafından yüklenip kullanılır
  model_report.txt    — feature importance ve doğruluk raporu

NOT:
  En az 50 etiketli sinyal (24h outcome) gereklidir.
  signal_tracker.py yeterli veri biriktirince çalıştır.
"""

import json
import os
import numpy as np
from datetime import datetime

# ── BAĞIMLILIK KONTROLÜ ──────────────────────────────────────────────────────
import sys
import subprocess

def ensure_packages():
    missing = []
    for pkg, pip_name in [('xgb', 'xgboost'), ('sklearn', 'scikit-learn'), ('optuna', 'optuna')]:
        try:
            if pkg == 'xgb':
                import xgboost
            elif pkg == 'sklearn':
                import sklearn
            elif pkg == 'optuna':
                import optuna
        except ImportError:
            missing.append(pip_name)
    if missing:
        print(f"  Eksik kütüphaneler kuruluyor: {missing}")
        try:
            # --break-system-packages is required for system python environments under PEP 668
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing + ["--break-system-packages", "-q"])
            print("  Kurulum tamamlandı.\n")
        except Exception as e:
            print(f"  Kurulum hatası: {e}")

ensure_packages()

import xgboost as xgb
from sklearn.model_selection import train_test_split, cross_val_score, TimeSeriesSplit
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.preprocessing import LabelEncoder
try:
    import optuna
    _OPTUNA_AVAILABLE = True
except ImportError:
    _OPTUNA_AVAILABLE = False

SIGNAL_FILE  = "signal_log.json"
MODEL_FILE   = "signal_filter.json"
REPORT_FILE  = "model_report.txt"
MIN_SAMPLES  = 50    # Minimum eğitim verisi
TARGET_HOURS = 24    # 24h WIN/LOSS etiketini hedef al

FEATURE_COLS = [
    "rsi", "stoch_k", "bb_pct", "z_score", "vol_ratio",
    "adx", "atr_pct", "macd_pos", "trend_4h",
    "rsi_4h", "bb_pct_4h", "macd_pos_4h", "z_score_4h",
    "ob_imbalance", "volatility"
]

# DÜZELTME P1-2: Eksik feature'lar için nötr varsayılan değerler
# Eski: feat.get(c, 0) → RSI=0 "aşırı satım" anlamına geliyordu
NEUTRAL_DEFAULTS = {
    "rsi": 50.0, "stoch_k": 50.0, "bb_pct": 0.5, "z_score": 0.0,
    "vol_ratio": 1.0, "adx": 20.0, "atr_pct": 1.5, "macd_pos": 0.0,
    "trend_4h": 0.0, "rsi_4h": 50.0, "bb_pct_4h": 0.5,
    "macd_pos_4h": 0.0, "z_score_4h": 0.0,
    "ob_imbalance": 0.5, "volatility": 0.0,
}

# DÜZELTME P1-2: One-hot encoding için rejim listesi (eski ordinal encoding kaldırıldı)
REGIME_LIST = ["TRENDING_UP", "TRENDING_DOWN", "CHOPPY", "HIGH_VOL"]
# Geriye uyumluluk — eski kodda REGIME_ENCODER kullanan yerler için
REGIME_ENCODER = {"TRENDING_UP": 0, "TRENDING_DOWN": 1, "CHOPPY": 2, "HIGH_VOL": 3, "UNKNOWN": 4}


def load_training_data():
    """signal_log.json'dan eğitim verisini yükle."""
    if not os.path.exists(SIGNAL_FILE):
        print(f"  HATA: {SIGNAL_FILE} bulunamadı.")
        print("  Bot çalışırken signal_tracker.py otomatik veri toplar.")
        return None, None

    with open(SIGNAL_FILE, encoding="utf-8") as f:
        signals = json.load(f)

    key = f"{TARGET_HOURS}h"
    # DÜZELTME P1-2: Triple barrier etiketini tercih et, yoksa 24h'ye fallback
    labeled = [s for s in signals 
               if ("triple_barrier" in s.get("checks", {}) or key in s.get("checks", {}))
               and "features" in s]
    
    # Zamana göre sırala (TimeSeriesSplit için kritik)
    labeled.sort(key=lambda s: s.get("timestamp", 0))

    print(f"  Toplam sinyal  : {len(signals)}")
    tb_count = sum(1 for s in labeled if "triple_barrier" in s.get("checks", {}))
    h24_count = len(labeled) - tb_count
    print(f"  Etiketli sinyal: {len(labeled)} (triple_barrier: {tb_count}, 24h: {h24_count})")

    if len(labeled) < MIN_SAMPLES:
        print(f"\n  UYARI: {MIN_SAMPLES} etiketli sinyal gerekli, şu an {len(labeled)} var.")
        print(f"  Daha fazla veri birikene kadar beklemeye devam et.")
        if len(labeled) < 20:
            return None, None
        print(f"  {len(labeled)} sinyal ile demo eğitim yapılıyor (güvenilirlik düşük)...\n")

    X, y = [], []
    for sig in labeled:
        feat = sig["features"]
        # DÜZELTME P1-2: Nötr varsayılan değerler kullan (eski: 0 → RSI=0 "aşırı satım" demekti)
        row = [feat.get(c, NEUTRAL_DEFAULTS.get(c, 0)) for c in FEATURE_COLS]
        # DÜZELTME P1-2: Rejim one-hot encoding (eski ordinal: UP=0, DOWN=1 yapay sıralama)
        regime = sig.get("regime", "UNKNOWN")
        for r in REGIME_LIST:
            row.append(1.0 if regime == r else 0.0)
        row.append(sig.get("score", 0))  # Ham skor da özellik
        X.append(row)
        # DÜZELTME P1-2: Triple barrier etiketini tercih et
        tb = sig.get("checks", {}).get("triple_barrier", {})
        if tb:
            y.append(1 if tb["outcome"] == "WIN" else 0)
        else:
            y.append(1 if sig["checks"][key]["outcome"] == "WIN" else 0)

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)

    win_rate = y.mean() * 100
    print(f"  Win Rate (veri): {win_rate:.1f}%")
    print(f"  Özellik sayısı : {X.shape[1]}")
    return X, y


def train_model(X, y):
    """XGBoost modelini eğit ve değerlendir."""
    # DÜZELTME P1-2: One-hot rejim encoding'e uygun feature isimleri
    feature_names = FEATURE_COLS + ["regime_up", "regime_down", "regime_choppy", "regime_highvol", "raw_score"]

    # Sınıf dengesizliği varsa ağırlık ver
    n_pos = y.sum()
    n_neg = len(y) - n_pos
    scale_pos = n_neg / n_pos if n_pos > 0 else 1.0

    # DÜZELTME P1-2: Zaman serisi — rastgele karıştırma YOK (data leakage önlenir)
    # Eski: train_test_split(..., shuffle=True, random_state=42) → geleceğe bakıyordu
    # Yeni: İlk %75 train, son %25 test (zamana göre sıralı)
    split_idx = int(len(X) * 0.75)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    # Optuna Hiperparametre Optimizasyonu
    model = None
    if _OPTUNA_AVAILABLE and len(X_train) >= 30:
        try:
            import optuna
            optuna.logging.set_verbosity(optuna.logging.WARNING)

            def objective(trial):
                params = {
                    'n_estimators':     trial.suggest_int('n_estimators', 50, 250),
                    'max_depth':        trial.suggest_int('max_depth', 2, 7),
                    'learning_rate':    trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
                    'subsample':        trial.suggest_float('subsample', 0.6, 1.0),
                    'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
                    'min_child_weight': trial.suggest_int('min_child_weight', 1, 5),
                    'scale_pos_weight': scale_pos,
                    'eval_metric':      'logloss',
                    'random_state':     42
                }
                clf = xgb.XGBClassifier(**params)
                # K-fold Cross Validation ile ortalama ROC-AUC hesapla
                cv_folds = min(3, len(X_train) // 10)
                if cv_folds >= 2:
                    score = cross_val_score(clf, X_train, y_train, cv=cv_folds, scoring='roc_auc').mean()
                else:
                    clf.fit(X_train, y_train)
                    score = roc_auc_score(y_train, clf.predict_proba(X_train)[:, 1])
                return score

            study = optuna.create_study(direction='maximize')
            study.optimize(objective, n_trials=30, timeout=45)
            
            best_params = study.best_params
            best_params['scale_pos_weight'] = scale_pos
            best_params['eval_metric'] = 'logloss'
            best_params['random_state'] = 42
            print(f"  [Optuna] En iyi parametreler: {best_params}")
            model = xgb.XGBClassifier(**best_params)
        except Exception as ex:
            print(f"  [Optuna] Hata oluştu, varsayılan modele geçiliyor: {ex}")

    if model is None:
        model = xgb.XGBClassifier(
            n_estimators    = 200,
            max_depth       = 4,
            learning_rate   = 0.05,
            subsample       = 0.8,
            colsample_bytree= 0.8,
            scale_pos_weight= scale_pos,
            eval_metric     = 'logloss',
            random_state    = 42,
        )

    model.fit(X_train, y_train,
              eval_set=[(X_test, y_test)],
              verbose=False)

    # Değerlendirme
    y_pred      = model.predict(X_test)
    y_proba     = model.predict_proba(X_test)[:, 1]
    report_text = classification_report(y_test, y_pred, target_names=["LOSS","WIN"])

    try:
        auc = roc_auc_score(y_test, y_proba)
    except Exception:
        auc = 0.0

    # DÜZELTME P1-2: TimeSeriesSplit ile cross-validation (eski: random KFold → data leakage)
    cv_scores = []
    if len(X) >= 50:
        try:
            n_splits = min(5, len(X) // 30)
            if n_splits >= 2:
                tscv = TimeSeriesSplit(n_splits=n_splits)
                cv_scores = cross_val_score(model, X, y, cv=tscv, scoring='roc_auc')
        except Exception:
            pass

    print(f"\n  MODEL DEĞERLENDİRME:")
    print(f"  Test Accuracy   : {(y_pred == y_test).mean()*100:.1f}%")
    print(f"  ROC-AUC         : {auc:.3f}  (0.5=şans, 1.0=mükemmel)")
    if cv_scores is not None and len(cv_scores) > 0:
        print(f"  CV AUC (5-fold) : {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")
    print()
    print("  Sınıflandırma Raporu:")
    for line in report_text.split('\n'):
        print(f"  {line}")

    # Feature importance
    importance = dict(zip(feature_names, model.feature_importances_))
    importance = dict(sorted(importance.items(), key=lambda x: -x[1]))
    print("\n  ÖZELLİK ÖNEMİ (en yüksekten):")
    for feat, imp in importance.items():
        bar = "#" * int(imp * 50)
        print(f"  {feat:>16}: {bar} {imp:.3f}")

    return model, feature_names, importance, report_text, auc, cv_scores


def save_model(model, feature_names, importance, report_text, auc, cv_scores, num_samples):
    """Modeli XGBoost JSON formatında kaydet."""
    model.save_model(MODEL_FILE)
    print(f"\n  Model kaydedildi: {MODEL_FILE}")

    # Rapor dosyası
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(f"ANTIGRAVITY AI — XGBoost Model Raporu\n")
        f.write(f"Tarih: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"=" * 60 + "\n\n")
        f.write(f"ROC-AUC: {auc:.3f}\n")
        if cv_scores is not None and len(cv_scores) > 0:
            f.write(f"CV AUC : {cv_scores.mean():.3f} +/- {cv_scores.std():.3f}\n")
        f.write(f"\nÖzellik İsim Sırası:\n")
        for i, n in enumerate(feature_names):
            f.write(f"  {i}: {n}\n")
        f.write(f"\nÖzellik Önemi:\n")
        for feat, imp in importance.items():
            f.write(f"  {feat}: {imp:.4f}\n")
        f.write(f"\nSınıflandırma Raporu:\n{report_text}\n")
    print(f"  Rapor kaydedildi: {REPORT_FILE}")

    # Metadata (backend için)
    meta = {
        "trained_at":    datetime.now().strftime("%Y-%m-%d %H:%M"),
        "feature_names": feature_names,
        "feature_importance": {k: round(float(v), 4) for k, v in importance.items()},
        "auc":           round(auc, 4),
        "train_samples": num_samples,
        "threshold":     0.60,  # Win olasılığı bu değerin üzerindeyse al
        "usage": (
            "import xgboost as xgb; import numpy as np; "
            "m=xgb.XGBClassifier(); m.load_model('signal_filter.json'); "
            "prob=m.predict_proba([[rsi,stoch_k,...]])[0][1]; buy_ok = prob >= 0.60"
        )
    }
    with open("signal_filter_meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    print(f"  Metadata kaydedildi: signal_filter_meta.json")


def run_autotrain_logic(min_auc=0.55):
    """Programmatic entrypoint for background retraining task."""
    X, y = load_training_data()
    if X is None:
        return {"success": False, "reason": "No data or file not found"}
    if len(X) < MIN_SAMPLES:
        return {"success": False, "reason": f"Insufficient samples: {len(X)} < {MIN_SAMPLES}"}
        
    model, feat_names, importance, report_txt, auc, cv_scores = train_model(X, y)
    if auc < min_auc:
        return {
            "success": False,
            "reason": f"Safety check failed: ROC-AUC {auc:.3f} < {min_auc:.2f}",
            "auc": auc,
            "train_samples": len(X)
        }
        
    # ── KAYIT ÖNCESİ DOĞRULAMA ──
    try:
        test_input = np.zeros((1, X.shape[1]), dtype=np.float32)
        test_prob = model.predict_proba(test_input)[0][1]
        print(f"  Model doğrulama: {X.shape[1]} feature, test_prob={test_prob:.3f} ✓")
    except Exception as ve:
        return {
            "success": False,
            "reason": f"Model doğrulama hatası: {ve}",
            "auc": auc,
            "train_samples": len(X)
        }
    
    save_model(model, feat_names, importance, report_txt, auc, cv_scores, len(X))
    return {
        "success": True,
        "auc": auc,
        "train_samples": len(X),
        "n_features": X.shape[1],
        "cv_auc": float(cv_scores.mean()) if len(cv_scores) > 0 else None
    }


def predict_example(model):
    """Örnek tahmin — kullanım gösterimi."""
    print("\n  ÖRNEK TAHMİN (demo):")
    # Aligned to 17 features: [rsi, stoch_k, bb_pct, z_score, vol_ratio, adx, atr_pct, macd_pos, trend_4h, rsi_4h, bb_pct_4h, macd_pos_4h, z_score_4h, ob_imbalance, volatility, regime_code, raw_score]
    example = np.array([[32, 18, 0.08, -2.1, 1.8, 28, 1.2, 1, 1, 45, 0.3, 0, -1.0, 0.65, 2.1, 0, 78]], dtype=np.float32)
    proba   = model.predict_proba(example)[0][1]
    decision= "ALINIR" if proba >= 0.60 else "ATLANIR"
    print(f"  Giriş: RSI=32, StochK=18, BBpct=0.08, Z=-2.1, VolRatio=1.8")
    print(f"  Win Olasılığı: {proba*100:.1f}%  -> {decision}")
    print(f"  (Eşik: %60 — bu değerin üzerindeyse alım yapılır)")


def main():
    print("\n" + "=" * 60)
    print("  ANTIGRAVITY AI — XGBoost Model Eğitimi")
    print("=" * 60 + "\n")

    X, y = load_training_data()
    if X is None:
        print("\n  Eğitim verisi yetersiz. Bot çalışmaya devam etsin ve")
        print("  yeterli sinyal birikince tekrar çalıştır.\n")
        return

    print(f"\n  Model eğitiliyor ({len(X)} örnek)...")
    model, feat_names, importance, report_txt, auc, cv_scores = train_model(X, y)
    save_model(model, feat_names, importance, report_txt, auc, cv_scores, len(X))
    predict_example(model)

    print("\n  SONRAKI ADIM:")
    print("  Backend otomatik olarak signal_filter.json'u yükler.")
    print("  Yüklendi mi kontrol: GET /model-stats  -> ml_filter.available")
    print("  Backend'i yeniden başlatman gerekebilir.\n")


if __name__ == "__main__":
    main()
