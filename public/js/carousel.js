const track = document.querySelector('.carousel-track');
const prevBtn = document.querySelector('.carousel-btn.left');
const nextBtn = document.querySelector('.carousel-btn.right');

let index = 0;

const images = track.querySelectorAll('img');

function updateCarousel() {
	const imgWidth = images[0].clientWidth;

	track.style.transform = `translateX(-${index * imgWidth}px)`;
}

nextBtn.addEventListener('click', () => {
	if (index >= images.length - 1) {
		index = 0;
	} else {
		index++;
	}
	updateCarousel();
});

prevBtn.addEventListener('click', () => {
	if (index <= 0) {
		index = images.length - 1;
	} else {
		index--;
	}
	updateCarousel();
});

window.addEventListener('load', updateCarousel);

window.addEventListener('resize', updateCarousel);
