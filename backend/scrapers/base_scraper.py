"""
Base Scraper - Classe abstraite pour tous les scrapers
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from datetime import datetime
import asyncio
from playwright.async_api import async_playwright, Browser, Page


class BaseScraper(ABC):
    """Classe de base pour tous les scrapers de sites de football"""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None

    async def __aenter__(self):
        """Context manager pour initialiser le browser"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=self.headless)
        self.page = await self.browser.new_page()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager pour fermer le browser"""
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    @abstractmethod
    async def get_live_matches(self) -> List[Dict]:
        """
        Récupère tous les matchs en cours

        Returns:
            List[Dict]: Liste des matchs avec leurs infos de base
            {
                'id': str,
                'home_team': str,
                'away_team': str,
                'score': str,
                'time': str,
                'competition': str
            }
        """
        pass

    @abstractmethod
    async def get_match_stats(self, match_id: str) -> Dict:
        """
        Récupère les statistiques détaillées d'un match

        Args:
            match_id: Identifiant du match

        Returns:
            Dict: Stats complètes du match
            {
                'corners': {'home': int, 'away': int},
                'yellow_cards': {'home': int, 'away': int},
                'red_cards': {'home': int, 'away': int},
                'fouls': {'home': int, 'away': int},
                'shots': {'home': int, 'away': int},
                'shots_on_target': {'home': int, 'away': int},
                'possession': {'home': int, 'away': int},
                'offsides': {'home': int, 'away': int},
                'throw_ins': {'home': int, 'away': int},
                'dangerous_attacks': {'home': int, 'away': int},
                'attacks': {'home': int, 'away': int}
            }
        """
        pass

    async def wait_for_selector(self, selector: str, timeout: int = 5000):
        """Attendre qu'un sélecteur soit présent"""
        try:
            await self.page.wait_for_selector(selector, timeout=timeout)
            return True
        except Exception:
            return False

    async def safe_get_text(self, selector: str, default: str = "") -> str:
        """Récupérer le texte d'un élément en toute sécurité"""
        try:
            element = await self.page.query_selector(selector)
            if element:
                return await element.inner_text()
            return default
        except Exception:
            return default

    async def safe_get_attribute(self, selector: str, attr: str, default: str = "") -> str:
        """Récupérer un attribut d'un élément en toute sécurité"""
        try:
            element = await self.page.query_selector(selector)
            if element:
                value = await element.get_attribute(attr)
                return value if value else default
            return default
        except Exception:
            return default
