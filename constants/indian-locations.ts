/**
 * indian-locations.ts — Indian state & district reference data.
 *
 * Northeast India states appear first (Mizoram, Manipur, Meghalaya, Nagaland,
 * Tripura, Assam, Arunachal Pradesh, Sikkim) because the app primarily targets
 * users in Mizoram. Remaining states follow alphabetically.
 *
 * Used by the profile-completion screen for location selection.
 */

/** Represents a single state and its district list. */
export type StateData = {
    name: string;
    districts: string[];
};

export const INDIAN_STATES: StateData[] = [
    // ── Northeast India (priority) ──
    {
        name: 'Mizoram',
        districts: [
            'Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib',
            'Lawngtlai', 'Mamit', 'Siaha', 'Hnahthial', 'Khawzawl', 'Saitual',
        ],
    },
    {
        name: 'Manipur',
        districts: [
            'Imphal East', 'Imphal West', 'Bishnupur', 'Thoubal', 'Churachandpur',
            'Chandel', 'Ukhrul', 'Senapati', 'Tamenglong', 'Jiribam',
            'Kangpokpi', 'Kakching', 'Tengnoupal', 'Noney', 'Pherzawl', 'Kamjong',
        ],
    },
    {
        name: 'Meghalaya',
        districts: [
            'East Khasi Hills', 'West Khasi Hills', 'South West Khasi Hills',
            'Ri-Bhoi', 'East Jaintia Hills', 'West Jaintia Hills',
            'East Garo Hills', 'West Garo Hills', 'South Garo Hills',
            'North Garo Hills', 'South West Garo Hills', 'Eastern West Khasi Hills',
        ],
    },
    {
        name: 'Nagaland',
        districts: [
            'Kohima', 'Dimapur', 'Mokokchung', 'Wokha', 'Zunheboto',
            'Tuensang', 'Mon', 'Peren', 'Phek', 'Kiphire', 'Longleng',
            'Noklak', 'Chumukedima', 'Niuland', 'Shamator', 'Tseminyü',
        ],
    },
    {
        name: 'Tripura',
        districts: [
            'West Tripura', 'South Tripura', 'Dhalai', 'North Tripura',
            'Khowai', 'Gomati', 'Unakoti', 'Sipahijala',
        ],
    },
    {
        name: 'Assam',
        districts: [
            'Kamrup Metropolitan', 'Kamrup', 'Nagaon', 'Sonitpur', 'Cachar',
            'Dibrugarh', 'Jorhat', 'Tinsukia', 'Sivasagar', 'Golaghat',
            'Barpeta', 'Nalbari', 'Darrang', 'Dhubri', 'Goalpara',
            'Kokrajhar', 'Bongaigaon', 'Karimganj', 'Hailakandi', 'Morigaon',
            'Lakhimpur', 'Dhemaji', 'Baksa', 'Chirang', 'Udalguri',
            'Karbi Anglong', 'Dima Hasao', 'Biswanath', 'Charaideo',
            'Hojai', 'Majuli', 'South Salmara-Mankachar', 'West Karbi Anglong',
            'Bajali', 'Tamulpur',
        ],
    },
    {
        name: 'Arunachal Pradesh',
        districts: [
            'Itanagar Capital Complex', 'Tawang', 'West Kameng', 'East Kameng',
            'Papum Pare', 'Kurung Kumey', 'Kra Daadi', 'Lower Subansiri',
            'Upper Subansiri', 'West Siang', 'East Siang', 'Upper Siang',
            'Lower Siang', 'Lower Dibang Valley', 'Dibang Valley',
            'Lohit', 'Anjaw', 'Changlang', 'Tirap', 'Longding',
            'Namsai', 'Kamle', 'Siang', 'Lepa Rada', 'Pakke-Kessang', 'Shi Yomi',
        ],
    },
    {
        name: 'Sikkim',
        districts: [
            'Gangtok', 'Namchi', 'Gyalshing', 'Mangan',
            'Pakyong', 'Soreng',
        ],
    },

    // ── Rest of India (alphabetical) ──
    {
        name: 'Andhra Pradesh',
        districts: [
            'Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna',
            'Kurnool', 'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam',
            'Vizianagaram', 'West Godavari', 'YSR Kadapa',
        ],
    },
    {
        name: 'Bihar',
        districts: [
            'Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga',
            'Purnia', 'Begusarai', 'Samastipur', 'Vaishali', 'Nalanda',
        ],
    },
    {
        name: 'Chhattisgarh',
        districts: [
            'Raipur', 'Bilaspur', 'Durg', 'Korba', 'Rajnandgaon',
            'Jagdalpur', 'Raigarh', 'Ambikapur',
        ],
    },
    {
        name: 'Delhi',
        districts: [
            'Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi',
            'North East Delhi', 'North West Delhi', 'Shahdara',
            'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi',
        ],
    },
    {
        name: 'Goa',
        districts: ['North Goa', 'South Goa'],
    },
    {
        name: 'Gujarat',
        districts: [
            'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar',
            'Bhavnagar', 'Jamnagar', 'Junagadh', 'Kutch', 'Anand',
        ],
    },
    {
        name: 'Haryana',
        districts: [
            'Gurugram', 'Faridabad', 'Hisar', 'Rohtak', 'Karnal',
            'Panipat', 'Ambala', 'Yamunanagar', 'Sonipat', 'Panchkula',
        ],
    },
    {
        name: 'Himachal Pradesh',
        districts: [
            'Shimla', 'Kangra', 'Mandi', 'Solan', 'Sirmaur',
            'Una', 'Hamirpur', 'Kullu', 'Bilaspur', 'Chamba',
            'Kinnaur', 'Lahaul and Spiti',
        ],
    },
    {
        name: 'Jammu and Kashmir',
        districts: [
            'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Pulwama',
            'Udhampur', 'Kupwara', 'Rajouri', 'Kathua', 'Doda',
        ],
    },
    {
        name: 'Jharkhand',
        districts: [
            'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar',
            'Hazaribagh', 'Giridih', 'Dumka',
        ],
    },
    {
        name: 'Karnataka',
        districts: [
            'Bengaluru Urban', 'Mysuru', 'Hubli-Dharwad', 'Mangaluru',
            'Belagavi', 'Kalaburagi', 'Bellary', 'Tumkur', 'Shimoga', 'Davangere',
        ],
    },
    {
        name: 'Kerala',
        districts: [
            'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur',
            'Kannur', 'Kollam', 'Malappuram', 'Palakkad', 'Alappuzha',
            'Kottayam', 'Idukki', 'Pathanamthitta', 'Wayanad', 'Kasaragod',
        ],
    },
    {
        name: 'Madhya Pradesh',
        districts: [
            'Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain',
            'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa',
        ],
    },
    {
        name: 'Maharashtra',
        districts: [
            'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik',
            'Aurangabad', 'Solapur', 'Kolhapur', 'Amravati', 'Nanded',
        ],
    },
    {
        name: 'Odisha',
        districts: [
            'Bhubaneswar', 'Cuttack', 'Ganjam', 'Balasore', 'Mayurbhanj',
            'Jajpur', 'Sambalpur', 'Koraput', 'Sundargarh', 'Puri',
        ],
    },
    {
        name: 'Punjab',
        districts: [
            'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda',
            'Mohali', 'Hoshiarpur', 'Pathankot', 'Moga', 'Ferozepur',
        ],
    },
    {
        name: 'Rajasthan',
        districts: [
            'Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer',
            'Bikaner', 'Bhilwara', 'Alwar', 'Sikar', 'Pali',
        ],
    },
    {
        name: 'Tamil Nadu',
        districts: [
            'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
            'Tirunelveli', 'Erode', 'Vellore', 'Thanjavur', 'Thoothukudi',
        ],
    },
    {
        name: 'Telangana',
        districts: [
            'Hyderabad', 'Rangareddy', 'Medchal-Malkajgiri', 'Warangal',
            'Karimnagar', 'Nizamabad', 'Khammam', 'Nalgonda', 'Mahbubnagar', 'Adilabad',
        ],
    },
    {
        name: 'Uttar Pradesh',
        districts: [
            'Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Allahabad',
            'Meerut', 'Ghaziabad', 'Noida', 'Bareilly', 'Aligarh',
        ],
    },
    {
        name: 'Uttarakhand',
        districts: [
            'Dehradun', 'Haridwar', 'Nainital', 'Udham Singh Nagar',
            'Almora', 'Pauri Garhwal', 'Tehri Garhwal', 'Chamoli',
            'Pithoragarh', 'Champawat', 'Rudraprayag', 'Bageshwar', 'Uttarkashi',
        ],
    },
    {
        name: 'West Bengal',
        districts: [
            'Kolkata', 'North 24 Parganas', 'South 24 Parganas', 'Howrah',
            'Hooghly', 'Bardhaman', 'Nadia', 'Murshidabad', 'Malda', 'Jalpaiguri',
        ],
    },
];

/** Get district list for a given state name */
export function getDistrictsForState(stateName: string): string[] {
    const state = INDIAN_STATES.find((s) => s.name === stateName);
    return state?.districts ?? [];
}

/** Get all state names */
export function getStateNames(): string[] {
    return INDIAN_STATES.map((s) => s.name);
}
