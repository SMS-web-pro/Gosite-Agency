// Bibliothèque sectorielle — palettes (table officielle), images Unsplash,
// services, galeries, FAQ et prénoms locaux pour Mapper + Coder.

export type NicheContent = {
  match: string[];
  label: string;
  schemaType: string;
  primary: string;
  accent: string;
  neutralBg: string;
  style: "luxury" | "bold" | "warm" | "minimal" | "urban";
  displayFont: string;
  heroImage: string;
  aboutImage: string;
  icon: string;
  taglineTemplates: string[];
  trustBadges: string[];
  services: { icon: string; title: string; desc: string }[];
  gallery: { icon: string; title: string; desc: string; tag: string }[];
  process: { title: string; desc: string }[];
  faq: { q: string; a: string }[];
  guarantees: { icon: string; title: string; desc: string }[];
  testimonialServices: string[];
};

export const NICHES: NicheContent[] = [
  {
    match: ["barber", "barbier", "coiffeur", "salon", "coiffure", "hair"],
    label: "Barbershop / Salon",
    schemaType: "HairSalon",
    primary: "#1C1C2E", accent: "#C9A96E", neutralBg: "#F8F5EF",
    style: "urban", displayFont: "Fraunces",
    heroImage: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1920&q=80",
    aboutImage: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1920&q=80",
    icon: "scissors",
    taglineTemplates: ["L'art de la coupe, la précision en plus", "Votre style, notre signature", "La coupe parfaite, à chaque visite"],
    trustBadges: ["Barbiers certifiés", "Sans rendez-vous possible", "Produits premium"],
    services: [
      { icon: "scissors", title: "Coupe Signature", desc: "Coupe sur-mesure après diagnostic de votre morphologie et texture. Coiffage et conseils entretien inclus, 45 min chrono." },
      { icon: "sparkles", title: "Dégradé Précision", desc: "Fondu américain ou dégradé progressif exécuté à la tondeuse et aux ciseaux, contours nets garantis 3 semaines." },
      { icon: "feather", title: "Taille de Barbe", desc: "Sculptage de la barbe à la lame, serviette chaude et huile de soin pour une finition nette et une peau apaisée." },
      { icon: "droplets", title: "Rasage Traditionnel", desc: "Rasage à l'ancienne au coupe-chou, double passage et baume réparateur. Le rituel complet en 30 minutes." },
      { icon: "palette", title: "Coloration Homme", desc: "Camouflage des cheveux blancs ou coloration franche avec produits sans ammoniaque, résultat naturel immédiat." },
      { icon: "baby", title: "Coupe Enfant", desc: "Une approche patiente et ludique pour les moins de 12 ans, avec finition soignée et sans stress." },
    ],
    gallery: [
      { icon: "scissors", title: "Skin Fade Net", desc: "Fondu haute précision, contours parfaits", tag: "Dégradé" },
      { icon: "feather", title: "Barbe Sculptée", desc: "Ligne de joues nette à la lame", tag: "Barbe" },
      { icon: "sparkles", title: "Coupe Texturée", desc: "Volume maîtrisé, coiffage mat", tag: "Coupe" },
      { icon: "droplets", title: "Rasage Royal", desc: "Serviette chaude + coupe-chou", tag: "Rasage" },
      { icon: "palette", title: "Camouflage Gris", desc: "Coloration discrète, rendu naturel", tag: "Couleur" },
      { icon: "baby", title: "Première Coupe", desc: "Enfants accueillis avec patience", tag: "Enfant" },
    ],
    process: [
      { title: "Accueil & diagnostic", desc: "On écoute votre projet, on analyse votre chevelure et votre morphologie." },
      { title: "Coupe & finitions", desc: "Exécution précise, contours à la lame, vérification sous tous les angles." },
      { title: "Coiffage & conseils", desc: "Produits adaptés posés devant vous et gestes expliqués pour reproduire le style chez vous." },
      { title: "Suivi fidélité", desc: "Retouche contours offerte sous 10 jours sur les coupes signature." },
    ],
    faq: [
      { q: "Faut-il prendre rendez-vous ?", a: "Le salon fonctionne avec et sans rendez-vous. Les créneaux réservés sont prioritaires, mais des places walk-in sont gardées chaque jour." },
      { q: "Combien de temps pour une coupe + barbe ?", a: "Comptez 60 à 75 minutes pour le combo coupe signature et taille de barbe. La coupe seule prend environ 45 minutes." },
      { q: "Quels moyens de paiement acceptez-vous ?", a: "Espèces et cartes bancaires sont acceptées au comptoir. Le paiement mobile est également possible." },
      { q: "Faites-vous les dégradés sur cheveux bouclés ?", a: "Oui, l'équipe maîtrise les techniques spécifiques aux cheveux bouclés et crépus, avec tondeuse à peigne adapté et finition aux ciseaux." },
      { q: "Proposez-vous des produits à la vente ?", a: "Une sélection de cires, huiles à barbe et shampoings testés par nos barbiers est disponible en salon, avec conseils d'utilisation offerts." },
      { q: "À quelle fréquence entretenir un dégradé ?", a: "Un dégradé reste net environ 2 à 3 semaines. Une retouche express des contours permet de prolonger la coupe sans tout refaire." },
    ],
    guarantees: [
      { icon: "shield-check", title: "Satisfait ou retouché", desc: "Un détail ne vous plaît pas ? Retouche offerte sous 72h, sans discussion." },
      { icon: "timer", title: "Ponctualité", desc: "Votre rendez-vous commence à l'heure promise, sinon le café est offert." },
      { icon: "sparkles", title: "Hygiène irréprochable", desc: "Lames et peignes désinfectés devant vous, serviettes à usage unique." },
      { icon: "award", title: "Barbiers certifiés", desc: "Chaque membre de l'équipe a au minimum 5 ans de salon." },
    ],
    testimonialServices: ["dégradé", "taille de barbe", "rasage traditionnel", "coupe signature"],
  },
  {
    match: ["restaurant", "resto", "pizzeria", "brasserie", "bistrot", "traiteur"],
    label: "Restaurant",
    schemaType: "Restaurant",
    primary: "#1E0E05", accent: "#D4622A", neutralBg: "#FDF4ED",
    style: "warm", displayFont: "DM Serif Display",
    heroImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80",
    aboutImage: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1920&q=80",
    icon: "utensils",
    taglineTemplates: ["Une cuisine sincère, des produits du marché", "La table où l'on revient", "Fait maison, du marché à l'assiette"],
    trustBadges: ["Fait maison", "Produits du marché", "Terrasse en saison"],
    services: [
      { icon: "utensils", title: "Cuisine du Marché", desc: "Une carte courte qui suit l'arrivage du matin : chaque plat part d'un produit frais choisi le jour même." },
      { icon: "flame", title: "Grillades au Feu de Bois", desc: "Viandes maturées cuites à la braise pour un goût fumé authentique, cuisson à la minute devant la salle." },
      { icon: "leaf", title: "Plats Végétariens", desc: "Des assiettes végétales construites comme des plats à part entière, pas des accompagnements déguisés." },
      { icon: "cake-slice", title: "Desserts Maison", desc: "Pâtisseries préparées chaque matin par notre chef : tartes, crèmes et douceurs selon la saison." },
      { icon: "wine", title: "Sélection du Caveau", desc: "Vins de vignerons indépendants choisis en direct, avec accord conseillé pour chaque plat signature." },
      { icon: "users", title: "Privatisation & Groupes", desc: "Salon privatif jusqu'à 20 personnes pour vos repas d'affaires et événements de famille, menu sur-mesure." },
    ],
    gallery: [
      { icon: "flame", title: "Côte de Bœuf Braise", desc: "Maturée 30 jours, cuisson feu de bois", tag: "Grill" },
      { icon: "utensils", title: "Plat du Marché", desc: "Selon l'arrivage du jour", tag: "Du jour" },
      { icon: "cake-slice", title: "Tarte Saison", desc: "Pâtisserie maison du matin", tag: "Dessert" },
      { icon: "leaf", title: "Assiette Végétale", desc: "Création végétarienne signature", tag: "Veggie" },
      { icon: "wine", title: "Accord Vigneron", desc: "Sélection du caveau", tag: "Cave" },
      { icon: "users", title: "Table Privée", desc: "Salon jusqu'à 20 couverts", tag: "Groupe" },
    ],
    process: [
      { title: "Marché du matin", desc: "Le chef choisit chaque jour les produits directement auprès des producteurs locaux." },
      { title: "Mise en place", desc: "Tout est préparé sur place : fonds, sauces et pâtes sont faits maison." },
      { title: "Service à la minute", desc: "Les cuissons partent à la commande pour que chaque assiette arrive à la bonne température." },
      { title: "Le dernier mot", desc: "L'équipe passe en salle : vos retours du jour écrivent la carte de demain." },
    ],
    faq: [
      { q: "Faut-il réserver ?", a: "La réservation est conseillée le week-end et recommandée pour les groupes. En semaine, des tables sans réservation sont toujours disponibles." },
      { q: "Proposez-vous des options végétariennes ou sans gluten ?", a: "Oui, plusieurs plats végétariens sont au menu en permanence et la cuisine adapte la plupart des assiettes sans gluten sur demande." },
      { q: "Peut-on privatiser le restaurant ?", a: "Un salon privatif accueille jusqu'à 20 personnes. Contactez-nous pour un menu de groupe et une date." },
      { q: "Y a-t-il une terrasse ?", a: "La terrasse ouvre dès les beaux jours, à l'ombre l'été. Les tables en terrasse ne se réservent pas, premier arrivé premier servi." },
      { q: "Acceptez-vous les tickets restaurant ?", a: "Oui, les titres restaurant classiques et dématérialisés sont acceptés le midi, ainsi que les cartes bancaires." },
      { q: "Faites-vous la vente à emporter ?", a: "Toute la carte est disponible à emporter. Passez commande par téléphone et votre repas est prêt en 20 minutes." },
    ],
    guarantees: [
      { icon: "leaf", title: "Fraîcheur garantie", desc: "Aucun produit surgelé en cuisine : tout arrive frais du marché le matin même." },
      { icon: "timer", title: "Servi en 12 minutes", desc: "Le plat du jour arrive en moins de 12 minutes le midi, sinon le café est offert." },
      { icon: "heart-handshake", title: "Fait maison", desc: "Sauces, fonds et desserts préparés sur place, chaque jour." },
      { icon: "smile", title: "Flexibilité carte", desc: "Allergies ou régime particulier ? La cuisine s'adapte, signalez-le simplement." },
    ],
    testimonialServices: ["grillade au feu de bois", "plat du marché", "dessert maison", "repas de groupe"],
  },
  {
    match: ["plombier", "plumber", "plomberie", "chauffage", "hvac"],
    label: "Plombier / Chauffage",
    schemaType: "Plumber",
    primary: "#0B2545", accent: "#FF6B35", neutralBg: "#F0F4F8",
    style: "bold", displayFont: "Bebas Neue",
    heroImage: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1920&q=80",
    aboutImage: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=1920&q=80",
    icon: "wrench",
    taglineTemplates: ["Dépannage rapide, travail garanti", "Votre urgence, notre métier", "Des tuyaux d'acier, une parole d'homme"],
    trustBadges: ["Intervention sous 2h", "Devis gratuit", "Garantie 1 an pièces & main d'œuvre"],
    services: [
      { icon: "siren", title: "Urgence Fuite d'Eau", desc: "Localisation de fuite par caméra thermique et réparation immédiate. Intervention en moins de 2 heures, 7j/7." },
      { icon: "pipette", title: "Débouchage Canalisation", desc: "Furet électrique et hydrocurage haute pression pour évacuer les bouchons tenaces sans casser vos canalisations." },
      { icon: "flame", title: "Chauffe-Eau & Ballon", desc: "Installation et dépannage de chauffe-eau électriques et gaz. Remplacement le jour même en cas de panne totale." },
      { icon: "bath", title: "Rénovation Salle de Bain", desc: "De la robinetterie à la douche italienne complète : plomberie, carrelage et étanchéité par un artisan certifié." },
      { icon: "gauge", title: "Recherche de Fuite", desc: "Détection non destructive par gaz traceur et endoscopie : on trouve la fuite sans casser les murs." },
      { icon: "thermometer-sun", title: "Entretien Chaudière", desc: "Visite annuelle complète avec nettoyage, réglage combustion et attestation pour votre assurance habitation." },
    ],
    gallery: [
      { icon: "siren", title: "Fuite Colmatée", desc: "Urgence résolue en 1h20", tag: "Urgence" },
      { icon: "bath", title: "Douche Italienne", desc: "Rénovation complète 5 jours", tag: "Réno" },
      { icon: "flame", title: "Ballon Remplacé", desc: "Pose le jour même", tag: "Chauffe-eau" },
      { icon: "pipette", title: "Colonne Débouchée", desc: "Hydrocurage haute pression", tag: "Débouchage" },
      { icon: "gauge", title: "Fuite Introuvable", desc: "Détectée par caméra thermique", tag: "Diagnostic" },
      { icon: "thermometer-sun", title: "Chaudière Révisée", desc: "Attestation annuelle fournie", tag: "Entretien" },
    ],
    process: [
      { title: "Diagnostic au téléphone", desc: "Décrivez la panne, on évalue l'urgence et on annonce une fourchette de prix avant de partir." },
      { title: "Intervention rapide", desc: "Camion équipé de 300+ références : 9 réparations sur 10 se terminent dès la première visite." },
      { title: "Devis avant travaux", desc: "Aucun travail ne démarre sans votre accord écrit sur le montant annoncé." },
      { title: "Garantie & suivi", desc: "Facture détaillée et garantie 1 an main d'œuvre, avec rappel d'entretien offert." },
    ],
    faq: [
      { q: "Intervenez-vous vraiment en urgence ?", a: "Oui, 7j/7 et jours fériés compris. Les urgences fuites et pannes de chauffe-eau sont prises en charge en priorité, généralement sous 2 heures." },
      { q: "Combien coûte un déplacement ?", a: "Le déplacement et le diagnostic sont facturés à prix fixe et annoncés au téléphone. Si vous acceptez le devis de réparation, ils sont souvent déduits." },
      { q: "Le devis est-il payant ?", a: "Non, le devis est gratuit et sans engagement. Il est établi sur place ou par photo pour les petits travaux." },
      { q: "Réparez-vous ou remplacez-vous le chauffe-eau ?", a: "On répare tant que c'est viable. Si la cuve est percée ou l'appareil a plus de 12 ans, le remplacement est conseillé et réalisé le jour même." },
      { q: "Garantissez-vous vos réparations ?", a: "Toutes les interventions sont garanties 1 an pièces et main d'œuvre. En cas de souci, le retour est gratuit." },
      { q: "Acceptez-vous les dossiers d'assurance ?", a: "Oui, nous fournissons le rapport d'intervention et les photos nécessaires pour votre dégât des eaux." },
    ],
    guarantees: [
      { icon: "timer", title: "Sous 2 heures", desc: "Urgences prises en charge en moins de 2h, sinon le déplacement est offert." },
      { icon: "shield-check", title: "Garantie 1 an", desc: "Pièces et main d'œuvre garanties un an sur toutes les réparations." },
      { icon: "file-check", title: "Devis transparent", desc: "Prix annoncé avant travaux, aucun supplément surprise sur la facture." },
      { icon: "badge-check", title: "Artisan certifié", desc: "Assurance professionnelle et certifications à jour, justificatifs sur demande." },
    ],
    testimonialServices: ["fuite d'eau urgente", "remplacement de chauffe-eau", "débouchage", "rénovation de douche"],
  },
  {
    match: ["dentiste", "dentist", "dentaire", "dental"],
    label: "Dentiste / Médical",
    schemaType: "Dentist",
    primary: "#103A5E", accent: "#2DBE8F", neutralBg: "#F4FAFF",
    style: "minimal", displayFont: "Syne",
    heroImage: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1920&q=80",
    aboutImage: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1920&q=80",
    icon: "stethoscope",
    taglineTemplates: ["Un sourire sain commence ici", "La dentisterie douce et moderne", "Votre sourire mérite des experts"],
    trustBadges: ["Sans douleur", "Équipement dernière génération", "Urgences acceptées"],
    services: [
      { icon: "scan-line", title: "Bilan & Détartrage", desc: "Examen complet avec radio panoramique, détartrage ultrasonique doux et plan de traitement clair et chiffré." },
      { icon: "sparkles", title: "Blanchiment Dentaire", desc: "Éclaircissement professionnel avec gouttières sur-mesure : jusqu'à 6 teintes gagnées en deux séances." },
      { icon: "circle-plus", title: "Implants Dentaires", desc: "Remplacement de dents manquantes par implants titane, guidage 3D pour une pose précise et une cicatrisation rapide." },
      { icon: "baby", title: "Pédodontie", desc: "Suivi des enfants dès 3 ans : scellement des sillons, fluor et pédagogie pour des visites sans appréhension." },
      { icon: "align-center", title: "Orthodontie Invisible", desc: "Aligneurs transparents pour adultes et adolescents, avec simulation 3D du résultat avant de commencer." },
      { icon: "siren", title: "Urgence Dentaire", desc: "Rage de dent, abcès, dent cassée : créneaux d'urgence réservés chaque jour, appelez dès l'ouverture." },
    ],
    gallery: [
      { icon: "sparkles", title: "Blanchiment +5 Teintes", desc: "Deux séances, résultat naturel", tag: "Esthétique" },
      { icon: "circle-plus", title: "Implant Guidé 3D", desc: "Pose précise, cicatrisation rapide", tag: "Implant" },
      { icon: "align-center", title: "Aligneurs 8 Mois", desc: "Sourire réaligné sans bagues", tag: "Orthodontie" },
      { icon: "scan-line", title: "Bilan Complet", desc: "Panoramique + plan chiffré", tag: "Prévention" },
      { icon: "baby", title: "Première Visite", desc: "Enfants accueillis dès 3 ans", tag: "Enfant" },
      { icon: "siren", title: "Urgence Traitée", desc: "Rage de dent soulagée le jour même", tag: "Urgence" },
    ],
    process: [
      { title: "Accueil & bilan", desc: "Premier rendez-vous consacré à l'écoute, à l'examen clinique et aux radios nécessaires." },
      { title: "Plan de traitement", desc: "Chaque option est expliquée avec son devis : vous décidez en connaissance de cause." },
      { title: "Soins sans douleur", desc: "Anesthésie adaptée et gestes doux, avec pauses à la demande pendant le soin." },
      { title: "Suivi personnalisé", desc: "Rappels de contrôle automatiques et consignes d'hygiène adaptées à votre situation." },
    ],
    faq: [
      { q: "Comment obtenir un rendez-vous rapidement ?", a: "Téléphonez dès l'ouverture pour un créneau du jour. Les urgences (douleur, abcès) sont vues en priorité." },
      { q: "Le blanchiment abîme-t-il l'émail ?", a: "Non, le protocole professionnel utilise des concentrations maîtrisées et un suivi. Une sensibilité passagère de 24 à 48h est possible." },
      { q: "Acceptez-vous les nouveaux patients ?", a: "Oui, le cabinet accueille de nouveaux patients adultes et enfants. Le premier bilan permet d'établir votre dossier complet." },
      { q: "Proposez-vous des facilités de paiement ?", a: "Pour les traitements importants (implants, orthodontie), un échelonnement sans frais est possible. Le devis détaille tout." },
      { q: "Que faire en cas de rage de dent le week-end ?", a: "Appelez le cabinet dès l'ouverture : des créneaux d'urgence sont gardés chaque jour, y compris le samedi." },
      { q: "À quel âge emmener mon enfant la première fois ?", a: "Dès 3 ans pour une visite ludique de découverte. Les soins préventifs (scellement) commencent vers 6 ans." },
    ],
    guarantees: [
      { icon: "heart-pulse", title: "Soins sans douleur", desc: "Protocoles d'anesthésie modernes et gestes doux, même pour les plus anxieux." },
      { icon: "file-check", title: "Devis détaillé", desc: "Chaque traitement est chiffré avant de commencer, sans surprise." },
      { icon: "scan-line", title: "Imagerie 3D", desc: "Radiologie numérique basse dose et guidage 3D pour la précision des actes." },
      { icon: "siren", title: "Urgences quotidiennes", desc: "Des créneaux réservés chaque jour pour soulager la douleur sans attendre." },
    ],
    testimonialServices: ["blanchiment", "implant", "détartrage", "urgence dentaire"],
  },
  {
    match: ["gym", "fitness", "salle de sport", "musculation", "crossfit", "sport"],
    label: "Gym / Fitness",
    schemaType: "ExerciseGym",
    primary: "#0A0A0A", accent: "#E53935", neutralBg: "#F2F2F2",
    style: "bold", displayFont: "Bebas Neue",
    heroImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80",
    aboutImage: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1920&q=80",
    icon: "dumbbell",
    taglineTemplates: ["Forge ta force, chaque jour", "Ici on ne parle pas, on s'entraîne", "Ton objectif, notre programme"],
    trustBadges: ["Coachs diplômés", "Ouvert 7j/7", "Séance d'essai offerte"],
    services: [
      { icon: "dumbbell", title: "Musculation Guidée", desc: "Plateaux libres, machines à convergences et racks complets. Programme de démarrage offert à l'inscription." },
      { icon: "zap", title: "Cours Collectifs", desc: "HIIT, spinning, boxe-fit et mobility : 30 cours par semaine encadrés par des coachs diplômés d'État." },
      { icon: "activity", title: "Coaching Personnel", desc: "Bilan initial, programme sur-mesure et suivi mensuel avec mensurations pour des progrès mesurables." },
      { icon: "salad", title: "Plan Nutrition", desc: "Plans alimentaires adaptés à l'objectif (masse, sèche, santé) avec ajustements à chaque bilan." },
      { icon: "heart-pulse", title: "Remise en Forme", desc: "Reprise douce post-blessure ou après une longue pause : renforcement progressif et mobilité d'abord." },
      { icon: "users", title: "Small Group Training", desc: "Mini-groupes de 6 personnes maximum : l'énergie du collectif avec l'attention d'un coaching privé." },
    ],
    gallery: [
      { icon: "dumbbell", title: "Plateau Libre", desc: "Racks, barres olympiques, disques", tag: "Muscu" },
      { icon: "zap", title: "HIIT 45 Min", desc: "Brûle-graisse haute intensité", tag: "Cours" },
      { icon: "activity", title: "Bilan Complet", desc: "Mesures + programme offerts", tag: "Coaching" },
      { icon: "heart-pulse", title: "Zone Cardio", desc: "Tapis, rameurs, vélos connectés", tag: "Cardio" },
      { icon: "salad", title: "Plan Nutrition", desc: "Adapté à ton objectif", tag: "Nutrition" },
      { icon: "users", title: "Small Group", desc: "6 max, esprit d'équipe", tag: "Collectif" },
    ],
    process: [
      { title: "Séance d'essai", desc: "Viens tester la salle gratuitement : accès complet et présentation des zones." },
      { title: "Bilan de départ", desc: "Un coach évalue ta condition actuelle et définit un objectif réaliste à 12 semaines." },
      { title: "Programme sur-mesure", desc: "Plan d'entraînement et de nutrition adaptés à ton emploi du temps et ton niveau." },
      { title: "Bilans réguliers", desc: "Chaque mois on mesure, on ajuste et on relance : les progrès se voient en chiffres." },
    ],
    faq: [
      { q: "Puis-je essayer avant de m'abonner ?", a: "Oui, une séance d'essai gratuite est offerte sans engagement. Préviens simplement de ta venue par téléphone." },
      { q: "Débutant complet : par où commencer ?", a: "Le programme de démarrage inclus à l'inscription te fait découvrir chaque zone avec un coach pendant ta première semaine." },
      { q: "Quels sont les horaires d'ouverture ?", a: "La salle ouvre 7j/7, de bonne heure le matin jusqu'en soirée. Les heures exactes sont affichées en ligne et à l'accueil." },
      { q: "Y a-t-il des coachs sur place ?", a: "Des coachs diplômés sont présents aux heures de forte affluence. Le coaching personnel est disponible à la séance ou en pack." },
      { q: "L'abonnement est-il sans engagement ?", a: "Plusieurs formules existent, dont une mensuelle sans engagement. Les détails sont donnés à l'accueil, en toute transparence." },
      { q: "La salle est-elle mixte et adaptée aux femmes ?", a: "Bien sûr : la salle est mixte, avec des vestiaires séparés et des créneaux calmes pour s'entraîner sereinement." },
    ],
    guarantees: [
      { icon: "shield-check", title: "Essai gratuit", desc: "Teste la salle une séance complète avant toute décision." },
      { icon: "trophy", title: "Coachs diplômés", desc: "Cartes professionnelles affichées à l'accueil, diplômes d'État." },
      { icon: "line-chart", title: "Progrès mesurés", desc: "Bilans mensuels avec mensurations : tu vois tes progrès en noir et blanc." },
      { icon: "users", title: "Communauté bienveillante", desc: "Ici on s'encourage, débutants et confirmés partagent les mêmes racks." },
    ],
    testimonialServices: ["coaching personnel", "cours de HIIT", "programme de sèche", "remise en forme"],
  },
  {
    match: ["spa", "beauté", "beauty", "esthétique", "institut", "hammam", "massage"],
    label: "Beauty / Spa",
    schemaType: "DaySpa",
    primary: "#2D1B30", accent: "#E8A598", neutralBg: "#FDF7F4",
    style: "luxury", displayFont: "Cormorant Garamond",
    heroImage: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1920&q=80",
    aboutImage: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=1920&q=80",
    icon: "flower-2",
    taglineTemplates: ["Le bien-être, élevé en art", "Un parenthèse rien qu'à vous", "L'évasion commence à la porte"],
    trustBadges: ["Produits naturels", "Esthéticiennes diplômées", "Cabine duo disponible"],
    services: [
      { icon: "hand", title: "Massage Signature", desc: "Modelage profond aux huiles chaudes, pression ajustée à votre tension. 60 ou 90 minutes de déconnexion totale." },
      { icon: "flower-2", title: "Soin Visage Précieux", desc: "Nettoyage, gommage enzymatique, masque et modelage : la peau repart lumineuse, effet bonne mine immédiat." },
      { icon: "waves", title: "Rituel Hammam", desc: "Vapeur d'eucalyptus, gommage au savon noir et enveloppement : le rituel purifiant complet en 90 minutes." },
      { icon: "sparkles", title: "Épilation Douce", desc: "Cire tiède hypoallergénique et soin apaisant post-épilation pour une peau nette sans irritation." },
      { icon: "palette", title: "Manucure & Semi-Permanent", desc: "Soin des mains complet et pose longue tenue jusqu'à 3 semaines, finition impeccable garantie." },
      { icon: "heart", title: "Rituel Future Maman", desc: "Massage prénatal adapté et soin visage doux, pensé pour les femmes enceintes à partir du 4e mois." },
    ],
    gallery: [
      { icon: "hand", title: "Massage 90 Min", desc: "Huiles chaudes, déconnexion totale", tag: "Massage" },
      { icon: "flower-2", title: "Glow Immédiat", desc: "Soin visage éclat", tag: "Visage" },
      { icon: "waves", title: "Hammam Royal", desc: "Vapeur + gommage complet", tag: "Rituel" },
      { icon: "palette", title: "Manucure Signature", desc: "Tenue 3 semaines", tag: "Mains" },
      { icon: "sparkles", title: "Épilation Douce", desc: "Cire tiède hypoallergénique", tag: "Épilation" },
      { icon: "heart", title: "Cabine Duo", desc: "Rituel à deux en parallèle", tag: "Duo" },
    ],
    process: [
      { title: "Accueil & tisane", desc: "On vous installe, on note vos tensions et vos préférences autour d'une tisane de bienvenue." },
      { title: "Rituel sur-mesure", desc: "Pression, huiles et ambiance ajustées : chaque soin est calibré pour vous, pas pour la moyenne." },
      { title: "Temps de repos", desc: "Après le soin, le salon de repos prolonge la détente avant de retourner à la vraie vie." },
      { title: "Conseil peau", desc: "Vous repartez avec un diagnostic peau et les gestes pour prolonger l'effet du soin à la maison." },
    ],
    faq: [
      { q: "Faut-il réserver à l'avance ?", a: "Oui, les soins se font uniquement sur rendez-vous pour garantir une cabine rien qu'à vous. Le samedi part vite, réservez en début de semaine." },
      { q: "Proposez-vous des soins pour les hommes ?", a: "Bien sûr : massages, soins visage et rituels hammam sont mixtes et adaptés à toutes les peaux." },
      { q: "Puis-je offrir un soin ?", a: "Des cartes cadeaux sont disponibles pour tous les soins, valables 12 mois. Elles sont préparées joliment emballées sur simple appel." },
      { q: "Quels produits utilisez-vous ?", a: "Une gamme naturelle et hypoallergénique, choisie pour son efficacité et sa tolérance. Les références exactes sont communiquées en cabine." },
      { q: "Y a-t-il une cabine pour deux personnes ?", a: "Oui, la cabine duo permet de faire un massage ou un rituel en parallèle avec la personne de votre choix." },
      { q: "Le hammam est-il privatif ?", a: "Le hammam se privatise par créneau de 45 minutes : vous n'êtes jamais mélangés avec d'autres clients." },
    ],
    guarantees: [
      { icon: "leaf", title: "Produits naturels", desc: "Formules naturelles et hypoallergéniques uniquement, listes INCI consultables." },
      { icon: "flower-2", title: "Intimité totale", desc: "Cabines privatives et hammam privatif : votre soin vous appartient." },
      { icon: "badge-check", title: "Équipe diplômée", desc: "Esthéticiennes diplômées d'État, formations continues affichées au salon." },
      { icon: "heart", title: "Écoute réelle", desc: "Chaque soin commence par vos besoins du jour, pas par un protocole figé." },
    ],
    testimonialServices: ["massage signature", "rituel hammam", "soin visage", "manucure"],
  },
];

export const DEFAULT_NICHE: NicheContent = {
  match: [],
  label: "Service Local",
  schemaType: "LocalBusiness",
  primary: "#1B3A4B", accent: "#27A69A", neutralBg: "#F5F9FA",
  style: "minimal", displayFont: "Syne",
  heroImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80",
  aboutImage: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1920&q=80",
  icon: "store",
  taglineTemplates: ["Un service de qualité, près de chez vous", "L'expertise locale à votre service"],
  trustBadges: ["Devis gratuit", "Équipe expérimentée", "Satisfaction client"],
  services: [
    { icon: "star", title: "Prestation Signature", desc: "Notre service phare, réalisé par des professionnels expérimentés avec des équipements de qualité professionnelle." },
    { icon: "zap", title: "Intervention Express", desc: "Une prise en charge rapide pour vos demandes urgentes, avec un engagement clair sur les délais." },
    { icon: "shield-check", title: "Forfait Sérénité", desc: "Une offre complète qui couvre l'ensemble de vos besoins, avec suivi et garantie inclus." },
    { icon: "users", title: "Conseil Personnalisé", desc: "Un expert analyse votre situation et vous propose la solution la plus adaptée à votre budget." },
    { icon: "wrench", title: "Maintenance & Suivi", desc: "Entretien régulier et vérifications pour garder des installations fiables dans la durée." },
    { icon: "sparkles", title: "Finitions Premium", desc: "Le souci du détail jusqu'au bout : chaque intervention se termine par un contrôle qualité complet." },
  ],
  gallery: [
    { icon: "star", title: "Travail Soigné", desc: "Le souci du détail", tag: "Qualité" },
    { icon: "zap", title: "Réactivité", desc: "Intervention rapide", tag: "Express" },
    { icon: "shield-check", title: "Garantie", desc: "Travail couvert", tag: "Confiance" },
    { icon: "users", title: "Écoute Client", desc: "Conseil sur-mesure", tag: "Conseil" },
    { icon: "wrench", title: "Suivi Régulier", desc: "Maintenance assurée", tag: "Suivi" },
    { icon: "sparkles", title: "Finitions", desc: "Net et impeccable", tag: "Premium" },
  ],
  process: [
    { title: "Prise de contact", desc: "Décrivez votre besoin, on vous répond rapidement avec un premier avis." },
    { title: "Devis clair", desc: "Un devis détaillé et sans engagement vous est remis avant tout démarrage." },
    { title: "Réalisation", desc: "Le travail est exécuté dans les règles de l'art par notre équipe expérimentée." },
    { title: "Contrôle & garantie", desc: "Vérification finale ensemble et garantie écrite sur la prestation réalisée." },
  ],
  faq: [
    { q: "Comment obtenir un devis ?", a: "Appelez-nous ou envoyez un message : le devis est gratuit, détaillé et sans engagement." },
    { q: "Quels sont vos délais d'intervention ?", a: "Selon l'urgence et la charge, l'intervention est planifiée rapidement. Les urgences sont prioritaires." },
    { q: "Vos prestations sont-elles garanties ?", a: "Oui, chaque prestation est couverte par une garantie écrite dont les détails figurent sur le devis." },
    { q: "Intervenez-vous dans toute la ville ?", a: "Oui, nous couvrons toute la commune et les alentours immédiats, sans frais cachés de déplacement." },
    { q: "Quels moyens de paiement acceptez-vous ?", a: "Espèces et cartes bancaires sont acceptées. Les détails figurent sur le devis remis avant travaux." },
    { q: "Puis-je modifier mon rendez-vous ?", a: "Bien sûr : un simple appel suffit pour déplacer votre créneau sans frais jusqu'à la veille." },
  ],
  guarantees: [
    { icon: "file-check", title: "Devis gratuit", desc: "Clair, détaillé et sans engagement, remis avant tout travail." },
    { icon: "shield-check", title: "Travail garanti", desc: "Chaque prestation est couverte par une garantie écrite." },
    { icon: "timer", title: "Ponctualité", desc: "Rendez-vous respectés, prévenus à l'avance en cas d'imprévu." },
    { icon: "heart-handshake", title: "Proximité", desc: "Une équipe locale qui connaît le quartier et ses clients." },
  ],
  testimonialServices: ["prestation", "intervention", "devis", "suivi"],
};

export function findNiche(businessType: string): NicheContent {
  const t = businessType.toLowerCase();
  for (const n of NICHES) {
    if (n.match.some((m) => t.includes(m))) return n;
  }
  return DEFAULT_NICHE;
}

// Prénoms/noms pour témoignages adaptés à la culture locale
export const LOCAL_NAMES: Record<string, string[]> = {
  Maroc: [
    "Yassine El Amrani", "Salma Berrada", "Omar Benjelloun", "Khadija Tazi",
    "Mehdi Alaoui", "Imane Chaoui", "Hamza El Fassi", "Nisrine Bennis",
    "Karim Ouahbi", "Sara Lahlou",
  ],
  France: [
    "Sophie Martin", "Thomas Leroy", "Camille Dubois", "Julien Moreau",
    "Élise Fontaine", "Antoine Girard", "Marie Lambert", "Lucas Bernard",
    "Chloé Rousseau", "Hugo Petit",
  ],
  default: ["Alex Morgan", "Sam Carter", "Jamie Brooks", "Taylor Reed", "Casey Lane", "Jordan Beck"],
};

export function localeFor(country: string): { lang: string; dir: string; locale: string; currency: string; priceRange: string } {
  const c = country.toLowerCase().replace(/\./g, " ");
  if (c.includes("maroc")) {
    return { lang: "fr", dir: "ltr", locale: "fr-MA", currency: "MAD", priceRange: "$$" };
  }
  if (/\b(usa|us|united states|america)\b/.test(c) || /états[-\s]?unis|etats[-\s]?unis/.test(c)) {
    return { lang: "en", dir: "ltr", locale: "en-US", currency: "USD", priceRange: "$$" };
  }
  if (/\b(uk|united kingdom|england|great britain|gb)\b/.test(c) || /royaume[-\s]?uni/.test(c)) {
    return { lang: "en", dir: "ltr", locale: "en-GB", currency: "GBP", priceRange: "$$" };
  }
  return { lang: "fr", dir: "ltr", locale: "fr-FR", currency: "EUR", priceRange: "$$" };
}
