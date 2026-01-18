//----------------------------------------------------------------------//
//----Set Global Variables----//
//----------------------------------------------------------------------//

	let currentTab = 0; // Current tab is set to be the first tab (0)
	let timer = false;
	let duration = 700;

	let currentOverall = 0;
	let currentValue = 0;        // selected rating (0..5)
	let preview = 0;       // hover/preview value
	let locked = false;
	
	let editCache = {};
	let addORedit = '';
	

	//   const openBtn = document.getElementById('open');
	//   const starOverlay = document.getElementById('starOverlay');
	//   const ratingRow = document.querySelectorAll('[id^="ratingRow"]');
	//   const lockBtn = document.getElementById('lock');
	//   const cancelBtn = document.getElementById('cancel');
	//   const finalText = document.getElementById('finalText');


//----------------------------------------------------------------------//
//----Load Content Functions----//
//----------------------------------------------------------------------//
	
	//Load JSON data from PHP scripts
	async function fetchJSON(endpoint, filterData = null) {
		const options = filterData ? {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(filterData)
		} : {
			method: 'GET'
		};		
		const rawResponse = await fetch(endpoint, options);		
		if (!rawResponse.ok) throw new Error(`HTTP error! status: ${rawResponse.status}`);
		
		const response = await rawResponse.json();
		if (response.success == true) {
			console.log(response.message);
		} else {
			console.error(response.message);
		}
			
		return response;
	}

	//Get HTML content and load it into the main page
	async function loadHTMLContent(endpoint, elementId, keep){
		try{
			const response = await fetch(endpoint);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			if(keep)document.getElementById(elementId).innerHTML += await response.text();
			else document.getElementById(elementId).innerHTML = await response.text();
		} catch (error) {
			console.error ("Failed to load HTML from: " + endpoint + " - into element: " + elementId + "Response: " + error);
		}
	}

	//Load Dropdowns with links
	async function loadDropdown(endpoint, elementId, filterData) {
		const response = await fetchJSON(endpoint,filterData);
		try {
			try {
				if (response.success) {
					let htmlResponse = "";
					response.data.wineList.forEach(dataRow => {
						const values = Object.values(dataRow);
						if (elementId == "countryDropdown"){
							htmlResponse += `<a href="#" onclick="getWineData('./resources/php/getWines.php', {${elementId}: '${values[0]}',bottleCount: '0'}); ">(${values[1]}) <img src="images/flags/${values[2]}.svg" alt="" width="15" height="15"> ${values[0]}</a>`;
						}else{
							htmlResponse += `<a href="#" onclick="getWineData('./resources/php/getWines.php', {${elementId}: '${values[0]}',bottleCount: '0'}); ">(${values[1]}) ${values[0]}</a>`;
						}
					});
					document.getElementById(elementId).innerHTML = htmlResponse;
				}
			} catch (error) {
				console.error('Error:', error);
			}
		} catch (error) {
			console.error ("Failed to load drop down data from: " + endpoint + " - into element: " + elementId + "JSON Response: " + response);
		}
	}

	async function refreshDropDowns (filterData) {
		await loadDropdown('./resources/php/getCountries.php', 'countryDropdown', filterData);
		await loadDropdown('./resources/php/getTypes.php', 'typesDropdown', filterData);
		await loadDropdown('./resources/php/getRegions.php', 'regionDropdown', filterData);
		await loadDropdown('./resources/php/getProducers.php', 'producerDropdown', filterData);
		await loadDropdown('./resources/php/getYears.php', 'yearDropdown', filterData);
	}
	//Get wine data
	async function getWineData(endpoint, filterData, drunk = null) {
		const response = await fetchJSON(endpoint, filterData);
		//const tdata = await pushData(endpoint, filterData);
		//const data = JSON.parse(tdata);
		try {
			loadWineCardTemplate('contentArea', response.data.wineList, drunk);
		} catch(error) {
			console.error ("Failed to load wine data from: " + endpoint + ".  JSON Response: " + data + ". Error: " + error);
			document.getElementById('contentArea').innerHTML = "<p>Failed to load wines. Please try again.</p>";
		}
	}


	//Load WineCard Tempalte
	async function loadWineCardTemplate(elementId, wineData, drunk = null) {
		let response;
		console.log (wineData);
		try {
			// Use regular fetch for static HTML template
			
			if (drunk != null){
				response = await fetch('./drunkList.html');
			}else{
				response = await fetch('./wineCard.html');
			}
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const templateHTML = await response.text();
	
			// Prepare the template
			const temp = document.createElement('div');
			temp.innerHTML = templateHTML;
			const template = temp.querySelector('template');
	
			const loadedWines = document.getElementById(elementId);
			loadedWines.innerHTML = ''; // Optional: Clear existing cards
			const arr = [];

			if (wineData.length === 0) {
				loadedWines.innerHTML = '<h3>Start adding wines to see them here....</h3>'; // Optional: Clear existing cards
			} else {	
				for (const wineItem of wineData) {
					const clone = template.content.cloneNode(true);
					const card = clone.querySelector('.wineCard');
					card.id = wineItem.wineName;
		
					card.querySelector('.wineName').textContent = wineItem.wineName;
					card.querySelector('.winePicture').src = wineItem.pictureURL;
					card.querySelector('.regionProducer').textContent = `${wineItem.regionName} - ${wineItem.producerName}`;
					card.querySelector('.wineYear').textContent = wineItem.year;
					card.querySelector('.wineDescription').textContent = wineItem.description;
					card.querySelector('.wineTasting').textContent = wineItem.tastingNotes;
					card.querySelector('.winePairing').textContent = wineItem.pairing;

					if (drunk != null){
						card.querySelector('.wineRating').textContent = wineItem.avgRating;
						card.querySelector('.wineNotes').textContent = wineItem.Notes;
					}
		
					// Rating
					const bottleCountEl = card.querySelector('.bottleCount');
					const rating = wineItem.avgRating ?? 0;
					const bottlesDrunk = wineItem.bottlesDrunk ?? 0;
					

					const ratingCountIcon = card.querySelector('.wineRating');
					if (bottlesDrunk >0){
						const ratingText = document.createElement('span');
						ratingText.textContent = `${rating.toFixed(1)}/5`;
						bottleCountEl.appendChild(ratingText);
					}

					const addBottleIcons = (count, className) => {
						const fragment = document.createDocumentFragment();
						for (let i = 0; i < count; i++) {
							const icon = document.createElement('img');
							icon.src = './images/ui/bottleIcon.png';
							icon.className = className;
							fragment.appendChild(icon);
						}
						bottleCountEl.appendChild(fragment);
					};

					addBottleIcons(wineItem.standardBottles, 'bottleIcon');
					addBottleIcons(wineItem.largeBottles, 'bottleIconBig');
					addBottleIcons(wineItem.smallBottles, 'bottleIconSmall');



					

		
					// Country and flag
					const wineCountryEl = card.querySelector('.wineCountry');
					wineCountryEl.textContent = wineItem.countryName + ' ';
					const flag = document.createElement('img');
					flag.src = `./images/flags/${wineItem.code.toLowerCase()}.svg`;
					flag.className = 'flagIcon';
					wineCountryEl.appendChild(flag);

					

					// let ratingCountIcon = card.querySelector('.wineRating');
					// for (let i = 1; i <= avgRating; i++) {
					// 	const icon = document.createElement('img');
					// 	icon.src = './images/ui/glassIcon.png';
					// 	icon.className = 'glassIcon';
					// 	ratingCountIcon.appendChild(icon);					
					// }

					
					// Actions (Drink/Add)
					clone.querySelectorAll('.action-item').forEach(item => {
					item.onmousedown = () => {
						const actions = {
							drink: drinkBottle,
							add: addBottle,
							edit: editBottle
						};
						actions[item.dataset.action]?.(wineItem.wineID);
					};
				});

					loadedWines.appendChild(clone);
				}
			}
	
			initializeWineCardToggles();
		} catch (error) {
			document.getElementById('contentArea').innerHTML = "<p>Failed to load wines. Please try again.</p>";
			console.error('Error loading wine cards:', error);
		}
	}

	//Load the add wine elements and page
async function loadAddWinePage() {
    addORedit = 'add';
	try {
        document.getElementById("loadTag")?.remove();
        
        
        
        // Initialize empty lists with "not found" messages
        ['producer', 'wine'].forEach(type => {
            const listId = `${type}List`;
            document.getElementById(listId).innerHTML = createNotFoundItem(type);
            hideList(listId);
        });

        const allRegions = await fetchJSON('./resources/php/getRegions.php');        
        if (allRegions) {
            populateListHTML(allRegions, "regionList", "findRegion");
        }

        hideList("regionList");
        currentTab = 0;

    } catch (error) {
        console.error("Failed to load data for Add Wine page:", error);
        document.getElementById('contentArea').innerHTML = "<p>Failed to load Add Wine content. Please try again.</p>";
    }
}
	//Load the add wine elements and page
async function loadEditWinePage() {
    try {
        document.getElementById("loadTag")?.remove();        

    } catch (error) {
        console.error("Failed to load data for ediy Wine page:", error);
        document.getElementById('contentArea').innerHTML = "<p>Failed to load edit Wine content. Please try again.</p>";
    }
}

async function populateAddWineList(listToUpdate, filterData) {
    const config = {
        regionList: {
            endpoint: './resources/php/getProducers.php',
            filterKey: 'regionName',
            targetList: 'producerList',
            targetInput: 'findProducer',
            useStandardPopulate: true
        },
        producerList: {
            endpoint: './resources/php/getWines.php',
            filterKey: 'producerDropdown',
            targetList: 'wineList',
            targetInput: 'findWine',
            useStandardPopulate: false
        }
    };

    const settings = config[listToUpdate];
    if (!settings) return;

    const response = await fetchJSON(settings.endpoint, { [settings.filterKey]: filterData, bottleCount: '0' });
    
    if (settings.useStandardPopulate) {
        populateListHTML(response, settings.targetList, settings.targetInput);
    } else {
        // Custom wine list with year display
        const wineHTML = createNotFoundItem('wine') + response.data.wineList.map(wine => {
            const yearDisplay = wine.year ? ` - ${wine.year}` : '';
            return `<li tabindex="0" onmousedown="selectList('${wine.wineName}', '${settings.targetInput}', '${settings.targetList}')" class="listitem">${wine.wineName}${yearDisplay} (${wine.bottleCount})</li>`;
        }).join('');
        
        document.getElementById(settings.targetList).innerHTML = wineHTML;
    }
}

// Extracted helper functions
function populateListHTML(dataArray, elementId, inputId, labelIndex = 0, countIndex = 1) {
    const items = dataArray.data.wineList || dataArray;
    const listName = elementId.replace('List', '');
    
    const html = createNotFoundItem(listName) + items.map(item => {
        const values = Object.values(item);
        return `<li tabindex="0" onmousedown="selectList('${values[labelIndex]}', '${inputId}', '${elementId}')" class="listitem">${values[labelIndex]} (${values[countIndex]})</li>`;
    }).join('');
    
    document.getElementById(elementId).innerHTML = html;
}

function createNotFoundItem(type) {
    return `<li tabindex="0" onmousedown="selectList('none_found','find${type.charAt(0).toUpperCase() + type.slice(1)}','${type}List');showAddDetails('${type}');" style="display: none; font-size: 0.7em;" class="none_found"><a href="#">Tap here to add a new ${type}.</a></li>`;
}

	//allows onload to be used anywhere with a hidden / deleted img tag
	function executeFunctionByName(functionName, context /*, args */) {		
		var args = Array.prototype.slice.call(arguments, 2);
		document.getElementById(args[1]).remove();
		args.pop();
		var namespaces = functionName.split(".");
		var func = namespaces.pop();
		for(var i = 0; i < namespaces.length; i++) {
		  context = context[namespaces[i]];
		}
		return context[func].apply(context, args);
	}


//----------------------------------------------------------------------//
//----UI Functions----//
//----------------------------------------------------------------------//

function showAddDetails (listName){

	const addDetails = document.getElementById('new' + listName);
		if (!addDetails) return;

switch (listName){
	case 'region':
		document.getElementById('regionName').value = document.getElementById('findRegion').value;
		document.getElementById('findRegion').value = '';
		break;
	case 'producer':
		document.getElementById('producerName').value = document.getElementById('findProducer').value;
		document.getElementById('findProducer').value = '';
		break;
	case 'wine':
		document.getElementById('wineName').value = document.getElementById('findWine').value;
		document.getElementById('findWine').value = '';
		break;
} 

		addDetails.classList.add("ui-animate-opacity");
		addDetails.classList.remove("ui-animate-opacity-rev");
		addDetails.style.display = "";
}
	function initializeWineCardToggles() {
		const cards = document.getElementsByClassName("wineCard");

		for (const card of cards) {
			card.addEventListener("click", function () {
				const scrollTop = window.pageYOffset;
				const scrollLeft = window.pageXOffset;

				this.classList.toggle("active");

				const content = this.querySelector('.content');
				const contentCell = this.querySelector('.contentCell');

				// Show the content so scrollHeight can be measured
				contentCell.style.display = "";
				
				// Handle expand/collapse logic
				const isCollapsed = !content.style.height || content.style.height === "0px";
				
				if (isCollapsed) {
					const newHeight = content.scrollHeight + 100;
					content.style.height = newHeight + "px";
					content.style.maxHeight = content.scrollHeight + "px";
				} else {
					content.style.height = "0px";
					content.style.maxHeight = "0px";
					setTimeout(() => {
						contentCell.style.display = "none";
					}, 40);
				}

				// Prevent scroll jump on reflow
				requestAnimationFrame(() => {
					window.scrollTo(scrollLeft, scrollTop);
				});
			});
		}
		
		disableRightClick('.wineCard');
	}

	function nav_open() {
		//TODO: Make these global and namespace all UI Elements
		//const UI = {
		//	sidebar: document.getElementById("mySidebar"),
		//	overlay: document.getElementById("myOverlay")
		//};
		// Usage
		//UI.sidebar.style.display = "block";


		const sidebar = document.getElementById("mySidebar");
		// Apply sidebar animations and show it
		sidebar.classList.add("ui-animate-left");
		sidebar.classList.remove("ui-animate-right");
		sidebar.style.display = "block";
		showOverlay();
	}
	
	function nav_close() {
		//TODO: Make these global
		const sidebar = document.getElementById("mySidebar");
	
		// Reverse sidebar animation
		sidebar.classList.add("ui-animate-right");
		sidebar.classList.remove("ui-animate-left");
		hideOverlay();
		
	
		// Hide after animation finishes (sync with CSS duration)
		setTimeout(() => {
			sidebar.style.display = "none";
			overlay.style.display = "none";
		}, 300);
	}

	async function clearContentArea(newContent){
		//TODO: define globally and add to UI namespace
		const contentArea = document.getElementById("contentArea");
		if (!contentArea) return;

		contentArea.innerHTML = "";

		if (newContent) {
			await loadHTMLContent(newContent, "contentArea");
		}
	}

	function hideList(elementID) {
		const ul = document.getElementById(elementID);
		if (!ul || !ul.parentElement) return;

		const li = ul.getElementsByTagName("li");
		const searchBoxEle = ul.parentElement;
	
		for (let i = 0; i < li.length; i++) {
			li[i].style.display = "none";
		}
	
		searchBoxEle.style.height = "0px";
	}

	function showOverlay(){
		//fade the background
		//TODO: make global and add to UI namespace
		const overlay = document.getElementById("myOverlay");
		if (!overlay) return;
		overlay.classList.add("ui-animate-opacity");
		overlay.classList.remove("ui-animate-opacity-rev");
		overlay.style.display = "block";
		disableScroll();
	}

	function hideOverlay(){
		enableScroll();
		//TODO: make global and add to UI namespace
		const overlay = document.getElementById("myOverlay");
		if (!overlay) return;

		overlay.classList.add("ui-animate-opacity-rev");
		overlay.classList.remove("ui-opacity", "ui-animate-opacity");

		// Only hide after animation (optional based on your animation duration)
		setTimeout(() => {
			overlay.style.display = "none";
		}, 300);  // Adjust this delay to match your animation timing
	}

	function showList(elementID) {
		const ul = document.getElementById(elementID);
		const li = Array.from(ul.getElementsByTagName("li"));		
		li.pop();
		const searchBoxEle = ul.parentElement;

		// Show all the items except the last one (based on original logic)
		li.forEach(item => item.style.display = "");

		searchBoxEle.style.height = `${49 * li.length}px`;
		//remove List
		//turn element display to none
			
	}

	function filterList(searchBoxID, listElementID) {
		/* console.log(e);
		if (e != null){
			//show all the elements?
			producerTab = document.getElementById(elementID)
			producerInputs = producerTab.getElementsByTagName("input");
			producerTab.style.display = "";
			for (i = 0; i < producerInputs.length; i++) {
				producerInputs[i].className="";
			}
		} */
		const input = document.getElementById(searchBoxID);
		const filter = input.value.toUpperCase();
		const ul = document.getElementById(listElementID);
		const li = Array.from(ul.getElementsByTagName("li"));
		const searchBoxEle = input.parentElement.nextElementSibling;

		// Filter the list items based on the input
		const visibleItems = li.filter(item => {
			const txtValue = item.textContent || item.innerText;
			if ( txtValue.toUpperCase().includes(filter) || item.className == "none_found"){
				item.style.display = "";
				
				return true;
				
			} else {
				item.style.display = "none";
				return false;
			}
		});
		
		// Update the height based on the number of visible items or show none found
		if (visibleItems.length > 0) {
			searchBoxEle.style.height = `${49 * visibleItems.length}px`;
		}else {
			li[li.length -1].style.display = "";
			searchBoxEle.style.height = `49px`;
		}

	}

	//TODO: this is never called??
	function unselectList(searchBoxID, listElementID){
		//const input = document.getElementById(searchBoxID);

		//if (input.getAttribute("valid") !== "selected") return;

		//input.setAttribute("valid", "");

		//const formFields = document.getElementsByClassName("formFields");
		//formFields[currentTab].style.display = "block";

		//showTab(currentTab);
		//showList(listElementID);
		//filterList(searchBoxID, listElementID);
		
	}

	function selectList(selectedItem, searchBoxID, listElementID){
		
		const input = document.getElementById(searchBoxID);
		if(selectedItem != 'none_found'){input.value = selectedItem;}
		input.setAttribute("valid", "selected");

		const formFields = document.getElementsByClassName("formFields");
		if (formFields[currentTab]) {
		formFields[currentTab].style.display = "none";
		}
		populateAddWineList (listElementID, selectedItem);
		hideList(listElementID);
		//nextPrev(1);
	}

	function wineCardPopUp(elementID, e) {		
		showOverlay();		
		
		const element = document.getElementById(elementID);
		const popup = element.nextElementSibling;		

		let top = e.touches[0].clientY;
		let left = e.touches[0].clientX;
		popup.style.opacity = "0";
		popup.style.display = 'block';

		const maxTop = window.innerHeight - popup.clientHeight - 10;
		const maxLeft = window.innerWidth - popup.clientWidth - 10;

		top = Math.min(top, maxTop);
		left = Math.min(left, maxLeft);

		popup.style.top = `${top + window.scrollY}px`;
		popup.style.left = `${left + window.scrollX}px`;
		popup.style.opacity = "1";
		

	}

	function hidePopUps(){
		
		const popUps = document.querySelectorAll(".context-menu");
		popUps.forEach(popup => {
			popup.style.display = 'none';
		});
	}

 	function disableRightClick(elementID) {
		const elements = document.querySelectorAll(elementID);		
		overlay = document.getElementById("myOverlay");
		overlay.addEventListener('mousedown', () => {
			for(let i = 0; i < elements.length; i++) {
				for (const child of elements[i].children) {
					child.addEventListener('contextmenu', (e) => {
						//console.log(e);
						e.preventDefault();
			  		});	
				}

				elements[i].parentElement.addEventListener('contextmenu', (e) => {
					e.preventDefault();
		  		});
				elements[i].nextElementSibling.style.display = 'none';
			}	
		});
	}

	function touchStart(e){
		
		if (timer) return;

		let parentCard = (e.target);
		while (parentCard && parentCard.tagName.toLowerCase() != 'a'){
			parentCard = parentCard.parentElement;
		}
		if (!parentCard) return; // Safe guard

		// Add fade class immediately to trigger transition
		parentCard.classList.add('fade-to-dark');
		timer = setTimeout(onlongtouch, duration, parentCard.id, e);	
	}

	function touchMove(){
		if (timer) {
			clearTimeout(timer);
			timer = null;
	
			const fadingElement = document.querySelector(".fade-to-dark");
			if (fadingElement) {
				fadingElement.classList.remove("fade-to-dark");
			}
		}
	}

	function touchEnd(){	
		
		if (timer) {
			clearTimeout(timer);
			timer = null;
	
			const fadingElement = document.querySelector(".fade-to-dark");
			if (fadingElement) {
				fadingElement.classList.remove("fade-to-dark");
			}
		}
	}
	
	function onlongtouch(elementID, e){
		
		clearTimeout(timer);
		timer = null;

		const element = document.getElementById(elementID);
		if (element) {
			wineCardPopUp(elementID, e);
			element.classList.remove('fade-to-dark');
		}
	}
	


//----------------------------------------------------------------------//
//----App Functions----//
//----------------------------------------------------------------------//
	async function drinkBottle(wineID) {

		// //popup div with rating
		
		await loadHTMLContent("./rating.html", "contentArea", true);
		
		const response = await fetchJSON('./resources/php/getBottles.php', {wineID: wineID });

		try {
			const htmlResponse = response.data.bottleList.map(bottle => 
				`<option value="${bottle.bottleID}">${bottle.bottleSize} - ${bottle.source} (${bottle.dateAdded})</option>`
			).join('');

			document.getElementById('specificBottleDrunk').innerHTML = htmlResponse;
		} catch (error) {
			console.error ("Failed to load bottle list from:  - into element: JSON Response: " + response);
		}
		
		hidePopUps();


		const elem = document.querySelector('input[name="drinkDate"]');
		
		elem.value = new Date (Date.now()).toLocaleDateString('en-GB');
			const datepicker = new Datepicker(elem, {
			format: 'dd/mm/yyyy',
			todayButton: true,
				maxView: 2,
			todayButtonMode: 1,
			todayHighlight: true,
			});

		const starOverlay = document.getElementById('starOverlay');
		starOverlay.style.display = 'flex';


		document.getElementById('wineToRate').innerHTML = wineID;
		hideOverlay();


		const ratingRow = document.querySelectorAll('.rating-row');
		  // build 5 star buttons
		ratingRow.forEach(row => {
			let icon = row.id.replace("ratingRow","");
		  	for (let i = 1; i <= 10; i++) {
				const star = createRating(i, icon);
				row.appendChild(star);
		  	}
		});
		// wire buttons
	
		setTimeout(() => focusStar(1), 40);




		//need to store the ID of the bottle to know which one to delete
		//on delete, popup a table of each bottle - date, who from, stored
		//choose to delete
		
		
		

	}
	

	async function editBottle(wineID) {
		addORedit = 'edit';
		hidePopUps();
		await clearContentArea('./editWine.html');
		
		
		
		hideOverlay();
		//prompt to choose which bottle to edit
		document.getElementById('wineToEdit').innerHTML = wineID;
		const bottleData = await fetchJSON('./resources/php/getBottles.php', {wineID: wineID });

		

		editCache = bottleData;
		console.log(editCache);
		//if no bottles, then just skip and go to wine tab?

		//load new version of add bottle with prefilled data
		//get data from SQL call. Get sepcific region, get specific producer, get specific wine, get specific bottle...
		try {
			console.log(editCache);
			let htmlResponse = editCache.data.bottleList.map(bottle => 
				`<option value="${bottle.bottleID}">${bottle.bottleSize} - ${bottle.source} (${bottle.dateAdded})</option>`
			).join('');
			htmlResponse = `<option value="1">Choose A Bottle</option>` + htmlResponse;
			document.getElementById('bottleID').innerHTML = htmlResponse;
		} catch (error) {
			console.error ("Failed to load bottle list from:  - into element: JSON Response: "+ editCache.data);
		}

		//we can populate wineinfo here as well
		const wineData = await fetchJSON('./resources/php/getWines.php', {wineID: wineID });
		console.log(wineData);
		const { wineName, year, wineType, description, tastingNotes, pairing, pictureURL } = wineData.data.wineList.find(w => w.wineID == wineID) || {};
		document.getElementById('wineName').value = wineName || '';
		document.getElementById('wineYear').value = year || '';
		document.getElementById('wineTypeDropDown').value = wineType;
		document.getElementById('wineDescription').value = description || '';
		document.getElementById('wineTasting').value = tastingNotes || '';
		document.getElementById('winePairing').value = pairing || '';
		document.getElementById('winePicture').value = pictureURL || '';
		document.getElementById('winePicture').value = pictureURL || '';
		
		
		

		
	}

	function autoGrowAllTextareas() {
		document.querySelectorAll('textarea').forEach(textarea => {
			textarea.style.height = 'auto';
			textarea.style.height = textarea.scrollHeight + 'px';
		});
	}
	async function populateEditBottle(bottleID) {	
		
		//populate the fields with the bottle information
		const { bottleSize, location, source, price, currency } = editCache.data.bottleList.find(b => b.bottleID == bottleID) || {};

		document.getElementById('bottleSizeDropdown').value = bottleSize || '';
		document.getElementById('storageLocationDropDown').value = location || '';
		document.getElementById('bottleSource').value = source || '';
		document.getElementById('bottlePrice').value = price || '';
		document.getElementById('currencyDropdown').value = currency || '';


		//show the rest of the tab
		const extraDetails = document.getElementById('bottleExtraDetails');
		if (!extraDetails) return;
		extraDetails.classList.add("ui-animate-opacity");
		extraDetails.classList.remove("ui-animate-opacity-rev");
		extraDetails.style.display = "";
	}
	async function addWine(){	

		wineForm = document.getElementById("addWineForm");
		const formData = new FormData(wineForm);
		const data = {};
		
		formData.forEach((value, key) => {
			if (value == "") {
				switch (key) {
					case "winePicture":
						value = "images/wines/placeBottle.png";
						break;

				}
			}
			data[key] = value;
		});

		 const result = await pushData('./resources/php/addWine.php', data)
     if (result.success) {
        
		if (result.data.startsWith("\"Error")){
			console.error("Failed to add wine:", result.data);
			alert("Upload failed: " + result.data);
		}else{
			console.log("Wine added:", result.data);
			//check wine is actually added
			await loadHTMLContent("./sucess.html", "contentArea", true);
			hidePopUps();

			const starOverlay = document.getElementById('starOverlay');
			starOverlay.style.display = 'flex';
			hideOverlay();
		}
    } else {
        console.error("Failed to add wine:", result.error + "   -   " + result);
        alert("Wine Add failed: " + result.error);
		//should load an error popup and not clear out
		//this code should not clear out the form, it should retain the data if there is an error.
    }


		
		
		
	}
	async function editWine(){	

		wineForm = document.getElementById("editWineForm");
		const formData = new FormData(wineForm);
		const data = {};
		
		formData.forEach((value, key) => {
			if (value == "") {
				switch (key) {
					case "winePicture":
						value = "images/wines/placeBottle.png";
						break;

				}
			}
			data[key] = value;
		});
		data.wineID = document.getElementById('wineToEdit').innerHTML;
		
		console.log(data);

		const [bottleResult, wineResult] = await Promise.allSettled([
			pushData('./resources/php/updateBottle.php', data),
			pushData('./resources/php/updateWine.php', data)
		]);

		if (bottleResult.status === 'fulfilled') {
			console.log('Bottle updated:', bottleResult.value.result);
		} else {
			console.error('Bottle update failed:', bottleResult.reason);
		}

		if (wineResult.status === 'fulfilled') {
			console.log('Wine updated:', wineResult.value.result);
		} else {
			console.error('Wine update failed:', wineResult.reason);
		}

		if (bottleResult.status === 'fulfilled' && bottleResult.status === 'fulfilled') {
			
			await loadHTMLContent("./sucess.html", "contentArea", true);
			hidePopUps();
			const starOverlay = document.getElementById('starOverlay');
			starOverlay.style.display = 'flex';
			hideOverlay();
		}
	}
	async function uploadImage () {
		const fileInput = document.getElementById('fileToUpload');
		const file = fileInput.files[0];
		const uploadStatus = document.getElementById("uploadStatus");
		uploadStatus.innerHTML = '';

		if (!file) {
			uploadStatus.innerHTML += "<span style='color:red'>Please select a file first.</span>";
			return;
		}
		const result = await pushData('./resources/php/upload.php', "winePictureUpload");

		if (result.success) {
			const isError = /^.?Error/.test(result.data);
			const color = isError ? 'red' : 'green';
			const message = isError ? result.data : 'File uploaded.';
			uploadStatus.innerHTML += `<span style='color:${color}'>${message}</span>`;
		}
	}

	async function pushData (endpoint, data){
		let bodyData;
		
		if (data == "winePictureUpload"){
			const fileInput = document.getElementById('fileToUpload');
  			const file = fileInput.files[0]; // grab the file object
			if (!file) {
				return Promise.reject("Error: No file selected."); // return error as a rejected promise
			}
			bodyData  = new FormData();
			bodyData .append("fileToUpload", file);
		}else{
			bodyData = JSON.stringify(data);
		}
		
		return fetch(endpoint, {
			method: 'POST',
			headers: bodyData instanceof FormData ? undefined : {
				'Content-Type': 'application/json'
			},
			body: bodyData
		})
		.then(response => {
			if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        return response.text();
	})
		.then(result => {
			if (data == "winePictureUpload"){
				if (result.startsWith("Filename: ")) {
					document.getElementById("winePicture").value = result.replace("Filename: ", "");
					return { success: true, data: result }; // return success object
				}else {
					document.getElementById("winePicture").value = "";
					return { success: false, data: result };
				}
			}else{
				return { success: true, data: result }; // return success object
			}        
    })
    .catch(error => {
        return { success: false, message: error.message || error }; // return failure object
    });


	}

	async function addBottle(wineID) {
		
		await loadHTMLContent("./addBottle.html", "contentArea", true);
		
		hidePopUps();

		const starOverlay = document.getElementById('starOverlay');
		starOverlay.style.display = 'flex';
		document.getElementById('wineToAdd').innerHTML = wineID;
		hideOverlay();
		
	}
	

//----------------------------------------------------------------------//
//----AI Functions----//
//----------------------------------------------------------------------//

async function getAIData (requestType, requestData){
	const apiKey = "AIzaSyCCqxRUoQuCkTlLD4m1Rm4ky51Ct-ATh_8"; // Replace with your actual API key
	const model = "gemini-2.5-pro";
	let generationConfig;
	let systemInstruction;

	if (requestType == "wine"){
	    generationConfig = {
    	    temperature: 0.25,
        	thinkingConfig: {
          		thinkingBudget: -1,
        	},
		};
        systemInstruction = {
			role: "system",
			parts: [{
				text: `You are a helpful expert wine sommelier. When given the input of a specific drink and the prodcuer, gather comprehensive information about that drink and provide information back to the user. Use reputable sources to verify data about the producer. Each text response should be around 100 words. Write for an intermediate-level wine student. Keep the tone professional yet vivid, using sensory language where appropriate. Only provide information that you are sure about. Include information about the ingedients in the drink (e.g. 75% Pinot Noir, 25% Chardonnay). Do not offer to provide additional help to the user. Do not include sources or references in the response. Keep all information about sources seperate to the structured output. Do not ask the user to provide additional information or clarifying information. If you cannot find the information or don't know the answer, then only respond using the same data structure and mention that the wine cannot be found. Output should use the following JSON structure. Do not include the schema or the structure in the output. JSON Structure: {format:{type: "json_schema",name: "wine",strict: true,schema: {type: "object",properties: {"description": {"type": "string","description": "A detailed description of the wine including any awards or highlights as well as serving recommendations."},"tasting": {"type": "string", "description": "A description of the nose and the palate of the wine"},"pairing": {"type": "string","description": "A description of the types of foods that the wine pairs with"},"drinkwindow": {"type": "object","description": "Two years that give a window of the best time to drink the wine.","properties": {"start": {"type": "integer","description": "The starting year of the optimal drinking window."},"end": {"type": "number","description": "The ending year of the optimal drinking window."}},"required": ["start","end"],"additionalProperties": false}},"required": ["description","tasting","pairing","drinkwindow"],"additionalProperties": false}}}`,
			}],
      	};
		
	}
	else if (requestType == "producer"){
		 generationConfig = {
    	    temperature: 0.25,
        	thinkingConfig: {
          		thinkingBudget: -1,
        	},
		};
        systemInstruction = {
			role: "system",
			parts: [{
				text: `You are a helpful expert wine sommelier. When given the input of a wine producer, gather comprehensive information about that wine producer and provide information back to the user. reputable sources to verify data about the wine producer. Each text response should be around 200 words. Write for an Use intermediate-level wine student. Keep the tone professional yet vivid, using sensory language where appropriate. Only provide information that you are sure about. Do not provide additional help to the user. Do not include sources or references in the response. Keep all information about sources seperate to the structured output. Do not ask the user to provide additional information or clarifying information. Do not give the user information about your task, only respond with the structured output. If you cannot find the information or don't know the answer, then only respond using the same data structure. Output should use the following JSON structure. Do not include any other contextual information outside of this shcema structure. Do not include the schema or the structure in the output. JSON Structure: {format:{type "json_schema", name: "wine", strict: true, schema: {type: "object", properties: {"description": {"type": "string", "description": "A detailed description of the producer including any unique facts or awards or highlights as well as wine or vintage recommendations."}, "ownership": {"type": "string" "description": "The ownership structure of the producer. For example Cooperative, LVMH, Family, etc."}, "founded": {"type' "integer", "description": "The year that the producer was founded in."},"town' {"type": "string", "description": "The town that the producer is based in.."}}, "required": ["description", "ownership", "founded", "town"], "additionalProperties ": false}}}`,
			}],
      	};
	}
	else if (requestType == "region"){
		 generationConfig = {
    	    temperature: 0.25,
        	thinkingConfig: {
          		thinkingBudget: -1,
        	},
		};
        systemInstruction = {
			role: "system",
			parts: [{
				text: `You are a helpful expert wine sommelier. When given the input of a type of drink and a region, gather comprehensive information about that region relevant to the production of the type of drink provided and provide information back to the user. Use reputable sources to verify data about the region. Each text response should be around 400 words. Write for an intermediate-level wine student. Keep the tone professional yet vivid, using sensory language where appropriate. Only provide information that you are sure about. Do not provide additional help to the user. Do not include sources or references in the response. Keep all information about sources seperate to the structured output. Do not ask the user to provide additional information or clarifying information. Do not give the user information about your task, only respond with the structured output. When providing a URL for a map of the region, ensure that the URL is publicly accessible. If you cannot find the information or don't know the answer, then only respond using the same data structure. Output should use the following JSON structure. Do not include any other contextual information outside of this shcema structure. Do not include the schema or the structure in the output. JSON Structure: {"format": {"type": "json_schema","name": "region","strict": true,"schema": {"type": "object","properties": {"description": {"type": "string","description": "A detailed description of the region including any unique history, facts, awards, or highlights as well as specific producer, drink, or vintage recommendations"},"soil": {"type": "string","description": "Details about the soil or geographical features of the region and how it affects the fruits grown and the drinks produced there"},"climate": {"type": "string","description": "Details about the climate of the region and how it affects the fruits grown and the drinks produced there"},"map": {"type": "string","description": "a URL of a map that shows an overview of the region related to the drink type provided"}},"required": ["description","soil","climate","map"],"additionalProperties": false}}}`,
			}],
      	};
	}

	const contents = [{
        role: "user",
        parts: [
        	{text: requestData}
        ]
	}];
		try {
		const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{
		   	method: 'POST',
		   	headers: {
				'Content-Type': 'application/json',
		   	},
		   	body: JSON.stringify({
				
				systemInstruction,
				contents,
            	generationConfig,
				tools: [
					{ google_search: {} }
				],
		   	}),
	   	});
	   const data = await response.json();
	   
	    if (data.candidates && data.candidates.length > 0) {
			for (const part of data.candidates[0].content.parts) {
				try{
					const normalized = cleanAndNormalizeJSON(part.text);
					return normalized;
				}catch (error){
					console.error('Error:', error);
					const errorReturn = {description: 'Error occurred while fetching response. Please try again.', tasting: '', pairing: ''}
					return errorReturn;
				}
			}			
		}
	} catch (error) {
        console.error('Error:', error);
		const errorReturn = {description: 'Error occurred while fetching response. Please try again.', tasting: '', pairing: ''}
        return errorReturn;

		//https://stackoverflow.com/questions/53762388/dynamically-decide-which-fetch-response-method-to-use/53762471
    }
}
function cleanAndNormalizeJSON(raw) {
  if (typeof raw !== "string") {
    // if it's already an object (from response.json()), return normalized
    return normalizeWrapper(raw);
  }

  try {
    // Step 1: strip markdown fences if present
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\n?/, '') // remove ```json or ```
      .replace(/```$/, '')           // remove trailing ```
	  .replace(/\s*\[\d+(\s*,\s*\d+)*\]/g, '');
    // Step 2: try to parse JSON
    const parsed = JSON.parse(cleaned);

    // Step 3: normalize wrapper
    return normalizeWrapper(parsed);
  } catch (err) {
    console.warn("⚠️ Could not parse JSON, returning raw text instead:", err);
    const errorReturn = {description: 'Error occurred while fetching response. Please try again.', tasting: '', pairing: ''}
	return errorReturn;
  }
}
function normalizeWrapper(obj) {
  if (!obj || typeof obj !== "object") return obj;

  // unwrap if the *only* key is "text"
  while (obj.text && Object.keys(obj).length === 1) {
    obj = obj.text;
  }

  return obj;
}

async function genRegionData (){
	//gen data can probably be combine for each type....don't need three functions
	countryDropDown = document.getElementById("countryDropDown");
	regionName = document.getElementById("regionName");

	countryDropDown.setAttribute("valid","");
	regionName.setAttribute("valid","");


	if (countryDropDown.value != "" && regionName.value != ""){
		
		//this showoverlay and loading wheel should be smarter, and could be a function. Need to stop the overlay onclick as well if loading

		showOverlay();
		document.getElementById("loader").innerHTML = "<div class='loading'></div>";

		
		data = await getAIData("region",  drinkTypeDropDown.value + " - " + regionName.value + ", " + countryDropDown.value);
		//setTimeout(() => {
		document.getElementById("loader").innerHTML = "";
		hideOverlay();

		const extraDetails = document.getElementById('regionExtraDetails');
		if (!extraDetails) return;
		extraDetails.classList.add("ui-animate-opacity");
		extraDetails.classList.remove("ui-animate-opacity-rev");
		extraDetails.style.display = "";
		//this should be condensed - maybe an onupdate action? or something else to do auto, but this is too many repititions
		document.getElementById("regionDescription").value = data.description
		document.getElementById("regionDescription").style.height = document.getElementById("regionDescription").scrollHeight + 'px';
		document.getElementById("regionClimate").value = data.climate
		document.getElementById("regionClimate").style.height = document.getElementById("regionClimate").scrollHeight + 'px';
		document.getElementById("regionSoil").value = data.soil
		document.getElementById("regionSoil").style.height = document.getElementById("regionSoil").scrollHeight + 'px';
		
		//show the section with a fade
		
		//}, "3000");
		
		
	}else {
		//this sets them both red...should be smarter
		regionName.setAttribute("valid","invalid");
		countryDropDown.setAttribute("valid", "invalid");
	}
}

async function genProducerData (){
	//gen data can probably be combine for each type....don't need three functions
	producerName = document.getElementById("producerName");

	producerName.setAttribute("valid","");


	if (producerName.value != ""){
		wineRegion = document.getElementById("findRegion").value;
		if (wineRegion ==""){
			wineRegion = document.getElementById("regionName").value;
		}			
		//this showoverlay and loading wheel should be smarter, and could be a function. Need to stop the overlay onclick as well if loading

		showOverlay();
		document.getElementById("loader").innerHTML = "<div class='loading'></div>";
		data = await getAIData("producer", drinkTypeDropDown.value  + " - " + producerName.value + " - " + wineRegion);
		//setTimeout(() => {
		document.getElementById("loader").innerHTML = "";
		hideOverlay();
		const extraDetails = document.getElementById('producerExtraDetails');
		if (!extraDetails) return;
		extraDetails.classList.add("ui-animate-opacity");
		extraDetails.classList.remove("ui-animate-opacity-rev");
		extraDetails.style.display = "";
		//this should be condensed - maybe an onupdate action? or something else to do auto, but this is too many repititions
		document.getElementById("producerDescription").value = data.description
		document.getElementById("producerDescription").style.height = document.getElementById("producerDescription").scrollHeight + 'px';
		
		document.getElementById("producerOwnership").value = data.ownership;
		document.getElementById("producerFounded").value = data.founded;
		document.getElementById("producerTown").value = data.town;
		
		
		
		
	}else {
		//this sets them both red...should be smarter
		producerName.setAttribute("valid","invalid");
	}
}

async function genWineData() {
	//gen data can probably be combine for each type....don't need three functions
	wineNameField = document.getElementById("wineName");
	wineYearField = document.getElementById("wineYear");

	wineNameField.setAttribute("valid","");
	wineYearField.setAttribute("valid","");

	
	if (wineNameField.value != ""){
		wineProducer = document.getElementById("findProducer").value;
		if (wineProducer ==""){
			wineProducer = document.getElementById("producerName").value;
		}			
		//this showoverlay and loading wheel should be smarter, and could be a function. Need to stop the overlay onclick as well if loading

		showOverlay();
		document.getElementById("loader").innerHTML = "<div class='loading'></div>";
		data = await getAIData("wine", wineTypeDropDown.value + " " + drinkTypeDropDown.value + " - " + wineNameField.value + ", " + wineYearField.value + " - " + wineProducer );
		
		//what do when data returns null....
		

		document.getElementById("loader").innerHTML = "";
		hideOverlay();
		const extraDetails = document.getElementById('wineExtraDetails');
		if (!extraDetails) return;
		extraDetails.classList.add("ui-animate-opacity");
		extraDetails.classList.remove("ui-animate-opacity-rev");
		extraDetails.style.display = "";

		if (data) {
			//this should be condensed - maybe an onupdate action? or something else to do auto, but this is too many repititions
			document.getElementById("wineDescription").value = data.description
			document.getElementById("wineDescription").style.height = document.getElementById("wineDescription").scrollHeight + 'px';
			
			document.getElementById("wineTasting").value = data.tasting
			document.getElementById("wineTasting").style.height = document.getElementById("wineTasting").scrollHeight + 'px';
			
			document.getElementById("winePairing").value = data.pairing
			document.getElementById("winePairing").style.height = document.getElementById("winePairing").scrollHeight + 'px';
		
			//console.log(data.drinkwindow.start + "-" + data.drinkwindow.end);
		}else{
			document.getElementById("wineDescription").value = "An error occoured generating the data. Please try again."
		}
		
		
	}else {
		//this sets them both red...should be smarter
		wineNameField.setAttribute("valid","invalid");
	}
}

//----------------------------------------------------------------------//
//----Form Navigation Functions----//
//----------------------------------------------------------------------//
	function showTab(n) {
		// This function will display the specified tab of the form ...
		var x = document.getElementsByClassName("tab");
		x[n].style.display = "grid";
		// ... and fix the Previous/Next buttons:
		if (n == 0) {
			document.getElementById("prevBtn").style.display = "none";
		} else {
			document.getElementById("prevBtn").style.display = "inline";
		}
		if (n == (x.length - 1)) {
			document.getElementById("nextBtn").innerHTML = "Submit";
		} else {
			document.getElementById("nextBtn").innerHTML = "Next";
		}
		// ... and run a function that displays the correct step indicator:
		fixStepIndicator(n)
	}

	function nextPrev(n) {
		if (n == -1 || validateForm() ) {
			// This function will figure out which tab to display		
			var x = document.getElementsByClassName("tab");
			// Exit the function if any field in the current tab is invalid:
			//if (n == 1 && !validateForm()) return false;
				
			// Increase or decrease the current tab by 1:
			currentTab = currentTab + n;
			// if you have reached the end of the form... :
			if (currentTab >= x.length) {
				//...the form gets submitted:
				//document.getElementById("addWineForm").submit();
				
				if (addORedit == 'add'){
					if (!confirm("Are you sure you want to add this wine?")) {
						currentTab = currentTab - n; return;
					}
					addWine();		
				}else if (addORedit == 'edit'){					
					if (!confirm("Are you sure you want to edit this wine?")) {
						currentTab = currentTab - n; return;					
					}
					editWine();
				}
				currentTab = x.length -1;
				
				//manage going back if there is an error
				// Hide the current tab:				
				return false;
			}else{
			// Otherwise, display the correct tab:
				if (n == -1){
					x[currentTab+1].style.display = "none";
				}else{
					x[currentTab-1].style.display = "none";	
				}
				showTab(currentTab);
				autoGrowAllTextareas();
			}
		}
	}
	

	function fixStepIndicator(n) {
		// This function removes the "active" class of all steps...
		var i, x = document.getElementsByClassName("step");
		for (i = 0; i < x.length; i++) {
			x[i].className = x[i].className.replace(" active", "");
		}
		//... and adds the "active" class to the current step:
		x[n].className += " active";
	}

	function validateForm() {
		var tabToValidate, formInputs, i, valid = true;
		
		tabToValidate = document.getElementsByClassName("tab");
		formInputs = tabToValidate[currentTab].querySelectorAll("input, TextArea");
		
		for (i = 0; i < formInputs.length; i++) {
			if (formInputs[i].getAttribute("valid") != "selected"){
				formInputs[i].setAttribute("valid","");

				if (formInputs[i].dataset.validatetype == "text") {
					if (formInputs[i].value == ""){
						// add an "invalid" class to the field:
						formInputs[i].setAttribute("valid","invalid");
						// and set the current valid status to false:
						valid = false;
					}else {
						
					}					
				}else if (formInputs[i].dataset.validatetype == "year") {
					if (formInputs[i].value == ""){
						//formInputs[i].setAttribute("valid","invalid");
						//valid = false;
					} else if (isNaN(formInputs[i].value) || isNaN(parseFloat(formInputs[i].value))) {
						formInputs[i].setAttribute("valid","invalid");
						valid = false;
					} else if (formInputs[i].value < 1000 || !formInputs[i].value > 2100) {
						formInputs[i].setAttribute("valid","invalid");
						valid = false;
					} else {
						
					}
				}else if (formInputs[i].dataset.validatetype = "date") {
					
				}
			}else{
				break;
			}
		}
		return valid;
		//each function and this should return a boolean value
		//pass in the current tab to validate
		//loop through each input, check the type, and then do the validation
			//if producer / wine is selected then all fields can be empty - this can be handled in the selectList function
			//if prodcuer is not selected (text does not match element in the list) then all fields must be filled in - or just use a classname tag?
	}
	window.genWineData = genWineData;


	



	// left: 37, up: 38, right: 39, down: 40,
// spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36
var keys = {37: 1, 38: 1, 39: 1, 40: 1};

function preventDefault(e) {
  e.preventDefault();
}

function preventDefaultForScrollKeys(e) {
  if (keys[e.keyCode]) {
    preventDefault(e);
    return false;
  }
}

// modern Chrome requires { passive: false } when adding event
var supportsPassive = false;
try {
  window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
    get: function () { supportsPassive = true; } 
  }));
} catch(e) {}

var wheelOpt = supportsPassive ? { passive: false } : false;
var wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';

// call this to Disable
function disableScroll() {
  window.addEventListener('DOMMouseScroll', preventDefault, false); // older FF
  window.addEventListener(wheelEvent, preventDefault, wheelOpt); // modern desktop
  window.addEventListener('touchmove', preventDefault, wheelOpt); // mobile
  window.addEventListener('keydown', preventDefaultForScrollKeys, false);
}

// call this to Enable
function enableScroll() {
  window.removeEventListener('DOMMouseScroll', preventDefault, false);
  window.removeEventListener(wheelEvent, preventDefault, wheelOpt); 
  window.removeEventListener('touchmove', preventDefault, wheelOpt);
  window.removeEventListener('keydown', preventDefaultForScrollKeys, false);
}


//----------------------------------------------------------------------//
//----Rating Functions----//
//----------------------------------------------------------------------//


function createRating(index, icon) {
    const btn = document.createElement('button');
    btn.className = 'star-btn';
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.setAttribute('aria-label', index + ' star' + (index === 1 ? '' : 's'));
    btn.dataset.value = String(index);

    // star SVG (uses currentColor)
	switch (icon){
		case "Overall":
			//btn.innerHTML = `<img src="./images/ui/glassIcon.png" class="glassIcon"/>`;
			btn.innerHTML = `<p>&#129346;</p>`;
			break;
		case "Value":
			//btn.innerHTML = `<img src="./images/ui/glassIcon.png" class="glassIcon"/>`;
			btn.innerHTML = `<p>&#128184;</p>`;
			break;
		}
    //btn.innerHTML = `<img src="./images/ui/glassIcon.png" class="glassIcon"/>`;
  
	//	<svg class="star-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    //  <path d="M10 2h4v6c0 1 .5 2 1.5 2.5V22h-7V10.5C9.5 10 10 9 10 8V2z"/>
  	//  </svg>`;

	

    // events
    btn.addEventListener('click', (event) => {
      if (locked) return;
      select(index, event.target.closest('.rating-row'));
      btn.focus(event.target.closest('.rating-row'));
    });

    btn.addEventListener('mouseenter', (event) => {
      if (locked) return;
      preview = index;
      render(event.target.closest('.rating-row'));
    });

    btn.addEventListener('mouseleave', (event) => {
      if (locked) return;
      preview = 0;
      render(event.target.closest('.rating-row'));
    });

    btn.addEventListener('focus', (event) => {
      if (locked) return;
      preview = index;
      render(event.target.closest('.rating-row'));
    });


    btn.addEventListener('blur', (event) => {
      if (locked) return;
      preview = 0;
      render(event.target.closest('.rating-row'));
    });

    return btn;
}

// render stars according to current/preview/locked
function render(ratingRow) {
    const children = Array.from(ratingRow.children);
    children.forEach((child, idx) => {
      const value = idx + 1;
      child.classList.remove('star-filled', 'star-preview');

      const activeValue = preview || currentOverall || currentValue;
      if (activeValue >= value) {
        child.classList.add('star-filled');
        child.setAttribute('aria-checked', 'true');
      } else {
        child.setAttribute('aria-checked', 'false');
      }

      // preview highlight when hovering but not committed
      if (!locked && preview && preview >= value) {
        child.classList.add('star-preview');
      }
    });

    // enable lock button only if a rating is selected and not locked
    lockBtn.disabled = locked || currentOverall === 0 || currentValue === 0;
}

// commit selection
function select(value, ratingRow) {
    let currentRow = ratingRow.id.replace("ratingRow","");
	switch (currentRow){
		case "Overall":
			currentOverall = value;
			break;
		case "Value":
			currentValue = value;
			break;
		}	
    preview = 0;
    render(ratingRow);
}

function cancelDrink() {
	closeModal();
}
// lock the rating
async function lockRating() {
    
	if (currentOverall === 0 || currentValue === 0)  return;
    locked = true;
    const ratingRow = document.querySelectorAll('.rating-row');
	// build 5 star buttons
	ratingRow.forEach(row => {
		render(row);
		row.querySelectorAll('.star-btn').forEach(b => {
			b.disabled = true;
			b.tabIndex = -1;
		});
	});

    // show final text
    //finalText.style.display = 'block';
    //finalText.textContent = `You rated this ${current} out of 5. Thank you!`;
    lockBtn.disabled = true;

    // disable all star buttons for keyboard navigation

    // optionally, do something with rating here (send to server etc.)
    //console.log(`You rated this ${current} out of 5. Thank you!`);
	const wineRating = {
		wineID: document.getElementById('wineToRate').innerHTML,
		bottleID: document.getElementById('specificBottleDrunk').value,
		overallRating: currentOverall,
		valueRating: currentValue,
		drinkDate: document.getElementById('drinkDate').value,
		buyAgain: document.getElementById('buyAgain').value,
		notes: document.getElementById('ratingNotes').value,

		};
	console.log(wineRating);
	//also confirm rating added or failed. If fail then don't delete bottle
		//pushData('./resources/php/rateWine.php', data);
	const data = await fetchJSON('./resources/php/drinkBottle.php', wineRating);
	console.log (data);
	closeModal();
}

// reset and close
function closeModal() {
    starOverlay.style.display = 'none';
    // reset
    currentOverall = 0; currentValue = 0; preview = 0; locked = false;
    wineToRate.style.display = 'none';
    wineToRate.textContent = '';
    lockBtn.disabled = true;
    // reset star buttons
	const ratingRow = document.querySelectorAll('.rating-row');
    ratingRow.forEach(row => {
		
		row.querySelectorAll('.star-btn').forEach(b => {
			b.disabled = false;
			b.tabIndex = 0;
			b.setAttribute('aria-checked', 'false');
		});
		render(row);
	});	
	clearContentArea();
	getWineData('./resources/php/getWines.php');
}

function focusStar(value) {
	const ratingRow = document.querySelectorAll('.rating-row');
	ratingRow.forEach(ratingRow => {
		const btn = ratingRow.querySelector(`.star-btn[data-value="${value}"]`);
		if (btn) btn.focus();
	});
}

function closeDropdowns(){
	const dropdowns = document.querySelectorAll('.dropdown');
	dropdowns.forEach(d => d.classList.remove('active'));
}