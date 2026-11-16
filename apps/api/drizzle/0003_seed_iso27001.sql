-- Sélection de mesures ISO/IEC 27001:2022 (annexe A) utiles pour qualifier un incident.
-- Les libellés sont des reformulations courtes (le texte officiel de la norme est payant).
-- Un administrateur peut en ajouter d'autres via POST /api/controls.
INSERT INTO "controls" ("framework", "code", "title", "description") VALUES
  ('ISO27001:2022', '5.7',  'Renseignement sur les menaces', 'Collecter et analyser les informations sur les menaces pour anticiper les attaques.'),
  ('ISO27001:2022', '5.15', 'Contrôle d''accès', 'Règles d''attribution et de limitation des accès aux informations et systèmes.'),
  ('ISO27001:2022', '5.24', 'Préparation à la gestion des incidents', 'Organisation, rôles et procédures définis à l''avance pour traiter les incidents.'),
  ('ISO27001:2022', '5.25', 'Qualification des événements de sécurité', 'Évaluer les événements pour décider s''ils constituent des incidents.'),
  ('ISO27001:2022', '5.26', 'Réponse aux incidents', 'Traiter les incidents selon les procédures prévues.'),
  ('ISO27001:2022', '5.27', 'Retour d''expérience après incident', 'Tirer les enseignements des incidents pour renforcer les mesures.'),
  ('ISO27001:2022', '5.28', 'Collecte des preuves', 'Identifier et conserver les éléments de preuve liés aux incidents.'),
  ('ISO27001:2022', '5.29', 'Sécurité pendant une perturbation', 'Maintenir la sécurité de l''information pendant une crise ou une interruption.'),
  ('ISO27001:2022', '5.34', 'Vie privée et données personnelles', 'Protéger les données à caractère personnel conformément aux obligations légales.'),
  ('ISO27001:2022', '6.8',  'Signalement des événements de sécurité', 'Permettre au personnel de signaler rapidement les événements observés.'),
  ('ISO27001:2022', '8.5',  'Authentification sécurisée', 'Mécanismes d''authentification robustes (mots de passe, MFA…).'),
  ('ISO27001:2022', '8.7',  'Protection contre les logiciels malveillants', 'Prévenir, détecter et éliminer les logiciels malveillants.'),
  ('ISO27001:2022', '8.8',  'Gestion des vulnérabilités techniques', 'Identifier, évaluer et corriger les vulnérabilités des systèmes.'),
  ('ISO27001:2022', '8.12', 'Prévention des fuites de données', 'Détecter et empêcher la divulgation non autorisée d''informations.'),
  ('ISO27001:2022', '8.13', 'Sauvegarde des informations', 'Sauvegardes régulières et testées pour pouvoir restaurer.'),
  ('ISO27001:2022', '8.15', 'Journalisation', 'Produire, protéger et conserver les journaux d''activité.'),
  ('ISO27001:2022', '8.16', 'Surveillance des activités', 'Surveiller les systèmes pour détecter les comportements anormaux.'),
  ('ISO27001:2022', '8.20', 'Sécurité des réseaux', 'Protéger et cloisonner les réseaux et leurs équipements.')
ON CONFLICT ("framework", "code") DO NOTHING;
