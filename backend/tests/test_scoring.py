"""
Scoring algorithm tests
"""

import pytest
from datetime import datetime, timedelta

from app.services.enrichment_pipeline import EnrichmentPipeline


class TestScoringAlgorithm:
    """Test the risk and attribution scoring algorithms"""
    
    def setup_method(self):
        """Set up test instance"""
        self.pipeline = EnrichmentPipeline()
    
    def test_risk_score_malicious_verdicts(self):
        """Test risk score calculation with malicious verdicts"""
        enrichment_results = {
            "virustotal": {
                "verdict": "malicious",
                "confidence": 90,
                "actor": None,
                "family": None,
                "evidence": "Multiple engines detected as malicious"
            },
            "urlscan": {
                "verdict": "malicious",
                "confidence": 85,
                "actor": None,
                "family": None,
                "evidence": "Malicious indicators found"
            }
        }
        
        score = self.pipeline.calculate_risk_score(enrichment_results)
        
        # Base 0 + 15 (malicious) + 15 (malicious) + 10 (multiple providers) = 40
        assert score == 40
    
    def test_risk_score_suspicious_verdicts(self):
        """Test risk score calculation with suspicious verdicts"""
        enrichment_results = {
            "virustotal": {
                "verdict": "suspicious",
                "confidence": 60,
                "actor": None,
                "family": None,
                "evidence": "Some engines flagged as suspicious"
            },
            "osint": {
                "verdict": "suspicious",
                "confidence": 40,
                "actor": None,
                "family": None,
                "evidence": "Suspicious HTTP status"
            }
        }
        
        score = self.pipeline.calculate_risk_score(enrichment_results)
        
        # Base 0 + 5 (suspicious) + 5 (suspicious) = 10
        assert score == 10
    
    def test_risk_score_multiple_provider_agreement(self):
        """Test risk score with multiple provider agreement"""
        enrichment_results = {
            "virustotal": {"verdict": "malicious", "confidence": 90},
            "urlscan": {"verdict": "malicious", "confidence": 85},
            "crowdstrike": {"verdict": "malicious", "confidence": 80},
            "osint": {"verdict": "benign", "confidence": 20}
        }
        
        score = self.pipeline.calculate_risk_score(enrichment_results)
        
        # Base 0 + 15*3 (malicious) + 10 (≥3 providers agree) = 55
        assert score == 55
    
    def test_risk_score_recent_activity(self):
        """Test risk score with recent activity"""
        recent_date = datetime.utcnow() - timedelta(days=3)
        
        enrichment_results = {
            "virustotal": {
                "verdict": "malicious",
                "confidence": 90,
                "last_seen": recent_date.isoformat()
            }
        }
        
        score = self.pipeline.calculate_risk_score(enrichment_results)
        
        # Base 0 + 15 (malicious) + 10 (recent activity) = 25
        assert score == 25
    
    def test_risk_score_actor_attribution(self):
        """Test risk score with actor attribution"""
        enrichment_results = {
            "virustotal": {
                "verdict": "malicious",
                "confidence": 90,
                "actor": "APT29",
                "family": "Cozy Bear"
            }
        }
        
        score = self.pipeline.calculate_risk_score(enrichment_results)
        
        # Base 0 + 15 (malicious) + 10 (actor attribution) = 25
        assert score == 25
    
    def test_risk_score_cap_at_100(self):
        """Test that risk score is capped at 100"""
        enrichment_results = {
            "virustotal": {"verdict": "malicious", "confidence": 90},
            "urlscan": {"verdict": "malicious", "confidence": 85},
            "crowdstrike": {"verdict": "malicious", "confidence": 80},
            "flashpoint": {"verdict": "malicious", "confidence": 75},
            "recorded_future": {"verdict": "malicious", "confidence": 70},
            "osint": {"verdict": "malicious", "confidence": 65}
        }
        
        score = self.pipeline.calculate_risk_score(enrichment_results)
        
        # Should be capped at 100
        assert score == 100
    
    def test_attribution_score_with_actor(self):
        """Test attribution score calculation with actor"""
        enrichment_results = {
            "virustotal": {
                "verdict": "malicious",
                "actor": "APT29",
                "family": "Cozy Bear"
            },
            "crowdstrike": {
                "verdict": "malicious",
                "actor": "APT29",
                "family": "Cozy Bear"
            }
        }
        
        score = self.pipeline.calculate_attribution_score(enrichment_results)
        
        # 40 (actor) + 30 (family) + 20 (multiple sources) = 90
        assert score == 90
    
    def test_attribution_score_with_family_only(self):
        """Test attribution score with family only"""
        enrichment_results = {
            "virustotal": {
                "verdict": "malicious",
                "family": "Cobalt Strike"
            }
        }
        
        score = self.pipeline.calculate_attribution_score(enrichment_results)
        
        # 30 (family) = 30
        assert score == 30
    
    def test_attribution_score_no_attribution(self):
        """Test attribution score with no attribution data"""
        enrichment_results = {
            "virustotal": {
                "verdict": "malicious",
                "confidence": 90
            }
        }
        
        score = self.pipeline.calculate_attribution_score(enrichment_results)
        
        # No attribution data = 0
        assert score == 0
    
    def test_risk_band_calculation(self):
        """Test risk band calculation"""
        assert self.pipeline.get_risk_band(10) == "Low"
        assert self.pipeline.get_risk_band(30) == "Medium"
        assert self.pipeline.get_risk_band(60) == "High"
        assert self.pipeline.get_risk_band(80) == "Critical"
